import { useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { Audio } from 'expo-av';
import { SIREN_MAX_MS, SIREN_URL } from '../config/constants';

// Vibration + looping alarm sound for newly assigned orders.
export default function useSiren() {
  const [isRinging, setIsRinging] = useState(false);
  const isRingingRef = useRef(false);
  const soundRef = useRef(null);
  const ringTimeoutRef = useRef(null);
  const vibeIntervalRef = useRef(null);

  const stopSiren = async () => {
    isRingingRef.current = false;
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
    if (vibeIntervalRef.current) { clearInterval(vibeIntervalRef.current); vibeIntervalRef.current = null; }
    Vibration.cancel();
    setIsRinging(false);
    const snd = soundRef.current;
    soundRef.current = null;
    if (snd) {
      try { await snd.stopAsync(); } catch (e) {}
      try { await snd.unloadAsync(); } catch (e) {}
    }
  };

  const startSiren = async () => {
    if (isRingingRef.current) return;
    isRingingRef.current = true;
    setIsRinging(true);
    Vibration.vibrate(700);
    vibeIntervalRef.current = setInterval(() => Vibration.vibrate(700), 1500);
    ringTimeoutRef.current = setTimeout(stopSiren, SIREN_MAX_MS);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: SIREN_URL },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      if (!isRingingRef.current) { try { await sound.unloadAsync(); } catch (e) {} return; }
      soundRef.current = sound;
    } catch (e) {}
  };

  return { isRinging, startSiren, stopSiren };
}
