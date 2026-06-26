import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from 'react';

export interface MusicPlayerHandle {
  loadFiles(files: FileList): void;
}

export const MusicPlayer = forwardRef<MusicPlayerHandle>(function MusicPlayer(_props, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [tracks, setTracks] = useState<{ name: string; url: string }[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('tg-music-volume');
    if (saved) setVolume(parseFloat(saved));
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem('tg-music-volume', String(volume));
  }, [volume]);

  useImperativeHandle(ref, () => ({
    loadFiles(files: FileList) {
      loadAudioFiles(files);
    },
  }));

  function loadAudioFiles(files: FileList) {
    if (!files || files.length === 0) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }
    tracks.forEach((t) => URL.revokeObjectURL(t.url));

    const audioFiles = Array.from(files)
      .filter((f) => f.type.startsWith('audio/') || /\.(mp3|ogg|wav|flac|m4a|aac|opus)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (audioFiles.length === 0) return;

    const newTracks = audioFiles.map((f) => ({
      name: f.name.replace(/\.[^.]+$/, ''),
      url: URL.createObjectURL(f),
    }));

    setTracks(newTracks);
    setCurrent(0);
    playTrack(newTracks, 0);
  }

  function playTrack(trackList: { name: string; url: string }[], index: number) {
    const track = trackList[index];
    if (!track) return;

    const audio = audioRef.current || new Audio();
    audio.src = track.url;
    audio.volume = volume;
    audio.onended = () => {
      const next = (index + 1) % trackList.length;
      setCurrent(next);
      playTrack(trackList, next);
    };
    audioRef.current = audio;
    audio.play();
    setPlaying(true);
  }

  function toggle() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }

  function next() {
    if (tracks.length === 0) return;
    const n = (current + 1) % tracks.length;
    setCurrent(n);
    playTrack(tracks, n);
  }

  if (tracks.length === 0) return null;

  return (
    <div className="music-player">
      <button className="btn btn-secondary btn-icon" onClick={toggle} title={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
      <button className="btn btn-secondary btn-icon" onClick={next} title="Next track">
        ⏭
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        className="music-volume"
        title={`Volume: ${Math.round(volume * 100)}%`}
      />
      <span className="music-name text-muted" title={tracks[current]?.name}>
        {tracks[current]?.name}
      </span>
    </div>
  );
});
