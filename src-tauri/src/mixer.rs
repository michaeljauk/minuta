//! Real-time audio mixer for combining mic and system audio streams.
//!
//! Both sources push f32 samples into lock-free ring buffers.
//! The mixer thread reads from both, sums, clamps, and writes to WAV + optional consumer.

use hound::{WavSpec, WavWriter};
use ringbuf::traits::{Consumer, Producer};
use ringbuf::{HeapCons, HeapProd};
use std::io::BufWriter;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::fs::File;
use std::path::Path;

const MIXER_INTERVAL_MS: u64 = 10;
const MIXER_CHUNK_SIZE: usize = 4800; // ~100ms at 48kHz

pub struct MixerHandle {
    thread: Option<std::thread::JoinHandle<()>>,
    stop_flag: Arc<AtomicBool>,
}

impl MixerHandle {
    /// Start the mixer thread. Reads from mic and system ring buffers,
    /// mixes them, and writes to the WAV file.
    ///
    /// If `system_consumer` is `None`, only mic audio is written (pass-through).
    /// If `transcriber_producer` is provided, mixed samples are also pushed there for live transcription.
    pub fn start(
        mic_consumer: HeapCons<f32>,
        system_consumer: Option<HeapCons<f32>>,
        output_path: &Path,
        sample_rate: u32,
    ) -> Result<Self, String> {
        Self::start_with_transcriber(mic_consumer, system_consumer, None, output_path, sample_rate)
    }

    pub fn start_with_transcriber(
        mic_consumer: HeapCons<f32>,
        system_consumer: Option<HeapCons<f32>>,
        transcriber_producer: Option<HeapProd<f32>>,
        output_path: &Path,
        sample_rate: u32,
    ) -> Result<Self, String> {
        let spec = WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let writer = WavWriter::new(
            BufWriter::new(
                File::create(output_path)
                    .map_err(|e| format!("Create WAV: {e}"))?
            ),
            spec,
        ).map_err(|e| format!("Create WAV writer: {e}"))?;

        let stop_flag = Arc::new(AtomicBool::new(false));
        let stop_clone = stop_flag.clone();

        let thread = std::thread::Builder::new()
            .name("audio-mixer".into())
            .spawn(move || {
                mixer_loop(mic_consumer, system_consumer, transcriber_producer, writer, stop_clone);
            })
            .map_err(|e| format!("Spawn mixer: {e}"))?;

        Ok(Self {
            thread: Some(thread),
            stop_flag,
        })
    }

    /// Stop the mixer and finalize the WAV file. Blocks until complete.
    pub fn stop(mut self) {
        self.stop_flag.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

impl Drop for MixerHandle {
    fn drop(&mut self) {
        self.stop_flag.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn mixer_loop(
    mut mic: HeapCons<f32>,
    mut system: Option<HeapCons<f32>>,
    mut transcriber: Option<HeapProd<f32>>,
    mut writer: WavWriter<BufWriter<File>>,
    stop_flag: Arc<AtomicBool>,
) {
    let mut mic_buf = vec![0.0f32; MIXER_CHUNK_SIZE];
    let mut sys_buf = vec![0.0f32; MIXER_CHUNK_SIZE];
    let mut mix_out = vec![0.0f32; MIXER_CHUNK_SIZE];

    loop {
        if stop_flag.load(Ordering::Relaxed) {
            drain_remaining(&mut mic, &mut system, &mut transcriber, &mut writer, &mut mic_buf, &mut sys_buf, &mut mix_out);
            break;
        }

        let mic_count = mic.pop_slice(&mut mic_buf);

        let mix_count = match &mut system {
            Some(sys) => {
                let sys_count = sys.pop_slice(&mut sys_buf[..mic_count.max(1)]);
                let count = mic_count.max(sys_count);
                for i in 0..count {
                    let m = if i < mic_count { mic_buf[i] } else { 0.0 };
                    let s = if i < sys_count { sys_buf[i] } else { 0.0 };
                    mix_out[i] = (m + s).clamp(-1.0, 1.0);
                }
                count
            }
            None => {
                for i in 0..mic_count {
                    mix_out[i] = mic_buf[i].clamp(-1.0, 1.0);
                }
                mic_count
            }
        };

        // Write to WAV
        for i in 0..mix_count {
            let sample = (mix_out[i] * i16::MAX as f32) as i16;
            let _ = writer.write_sample(sample);
        }

        // Feed transcriber
        if let Some(ref mut prod) = transcriber {
            if mix_count > 0 {
                let _ = prod.push_slice(&mix_out[..mix_count]);
            }
        }

        if mic_count == 0 {
            std::thread::sleep(std::time::Duration::from_millis(MIXER_INTERVAL_MS));
        }
    }

    let _ = writer.finalize();
}

fn drain_remaining(
    mic: &mut HeapCons<f32>,
    system: &mut Option<HeapCons<f32>>,
    transcriber: &mut Option<HeapProd<f32>>,
    writer: &mut WavWriter<BufWriter<File>>,
    mic_buf: &mut [f32],
    sys_buf: &mut [f32],
    mix_out: &mut [f32],
) {
    loop {
        let mic_count = mic.pop_slice(mic_buf);
        let sys_count = match system {
            Some(sys) => sys.pop_slice(&mut sys_buf[..mic_buf.len()]),
            None => 0,
        };

        if mic_count == 0 && sys_count == 0 {
            break;
        }

        let mix_count = mic_count.max(sys_count);
        for i in 0..mix_count {
            let m = if i < mic_count { mic_buf[i] } else { 0.0 };
            let s = if i < sys_count { sys_buf[i] } else { 0.0 };
            mix_out[i] = (m + s).clamp(-1.0, 1.0);
            let sample = (mix_out[i] * i16::MAX as f32) as i16;
            let _ = writer.write_sample(sample);
        }

        if let Some(ref mut prod) = transcriber {
            if mix_count > 0 {
                let _ = prod.push_slice(&mix_out[..mix_count]);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ringbuf::traits::Split;
    use ringbuf::HeapRb;

    #[test]
    fn mixer_writes_mic_only_to_wav() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_path_buf();

        let mic_rb = HeapRb::<f32>::new(4096);
        let (mut mic_prod, mic_cons) = mic_rb.split();

        // Push 100 samples of a simple signal
        let signal: Vec<f32> = (0..100).map(|i| (i as f32 * 0.1).sin() * 0.5).collect();
        mic_prod.push_slice(&signal);

        let mixer = MixerHandle::start(mic_cons, None, &path, 16000).unwrap();

        // Give mixer time to process
        std::thread::sleep(std::time::Duration::from_millis(50));

        // Signal stop
        drop(mic_prod);
        mixer.stop();

        // Verify WAV was written
        let reader = hound::WavReader::open(&path).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.sample_rate, 16000);
        let samples: Vec<i16> = reader.into_samples::<i16>().map(|s| s.unwrap()).collect();
        assert_eq!(samples.len(), 100);
    }

    #[test]
    fn mixer_mixes_two_sources() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_path_buf();

        let mic_rb = HeapRb::<f32>::new(4096);
        let (mut mic_prod, mic_cons) = mic_rb.split();

        let sys_rb = HeapRb::<f32>::new(4096);
        let (mut sys_prod, sys_cons) = sys_rb.split();

        // Push identical signals to both sources
        let signal: Vec<f32> = vec![0.25; 50];
        mic_prod.push_slice(&signal);
        sys_prod.push_slice(&signal);

        let mixer = MixerHandle::start(mic_cons, Some(sys_cons), &path, 16000).unwrap();

        std::thread::sleep(std::time::Duration::from_millis(50));

        drop(mic_prod);
        drop(sys_prod);
        mixer.stop();

        let reader = hound::WavReader::open(&path).unwrap();
        let samples: Vec<i16> = reader.into_samples::<i16>().map(|s| s.unwrap()).collect();
        assert_eq!(samples.len(), 50);

        // Mixed value: 0.25 + 0.25 = 0.5 → as i16: 0.5 * 32767 ≈ 16383
        for &s in &samples {
            assert!((s - 16383).abs() < 2, "Expected ~16383, got {s}");
        }
    }

    #[test]
    fn mixer_feeds_transcriber_producer() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_path_buf();

        let mic_rb = HeapRb::<f32>::new(4096);
        let (mut mic_prod, mic_cons) = mic_rb.split();

        let trans_rb = HeapRb::<f32>::new(4096);
        let (trans_prod, mut trans_cons) = trans_rb.split();

        let signal: Vec<f32> = vec![0.5; 80];
        mic_prod.push_slice(&signal);

        let mixer = MixerHandle::start_with_transcriber(
            mic_cons, None, Some(trans_prod), &path, 16000,
        ).unwrap();

        std::thread::sleep(std::time::Duration::from_millis(50));

        drop(mic_prod);
        mixer.stop();

        // Transcriber consumer should have received the same samples
        let mut out = vec![0.0f32; 4096];
        let count = trans_cons.pop_slice(&mut out);
        assert_eq!(count, 80);
        for &v in &out[..count] {
            assert!((v - 0.5).abs() < 0.01, "Expected ~0.5, got {v}");
        }
    }

    #[test]
    fn mixer_clamps_to_valid_range() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_path_buf();

        let mic_rb = HeapRb::<f32>::new(4096);
        let (mut mic_prod, mic_cons) = mic_rb.split();

        let sys_rb = HeapRb::<f32>::new(4096);
        let (mut sys_prod, sys_cons) = sys_rb.split();

        // Both sources at max → sum would be 2.0, should be clamped to 1.0
        mic_prod.push_slice(&[1.0; 10]);
        sys_prod.push_slice(&[1.0; 10]);

        let mixer = MixerHandle::start(mic_cons, Some(sys_cons), &path, 16000).unwrap();

        std::thread::sleep(std::time::Duration::from_millis(50));

        drop(mic_prod);
        drop(sys_prod);
        mixer.stop();

        let reader = hound::WavReader::open(&path).unwrap();
        let samples: Vec<i16> = reader.into_samples::<i16>().map(|s| s.unwrap()).collect();
        for &s in &samples {
            // Clamped to 1.0 → i16::MAX (32767)
            assert_eq!(s, i16::MAX, "Expected {}, got {s}", i16::MAX);
        }
    }
}
