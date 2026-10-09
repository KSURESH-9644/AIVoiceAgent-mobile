import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { getAppSettings, updateAppSettings } from '../store/AppSettings';
import type { AppSettings, Character, ConversationMode, VoiceCaptureMode, VoiceGender, TextDisplayMode } from '../types/voice';

const SettingsScreen = () => {
  const [settings, setSettings] = useState<AppSettings>(getAppSettings());
  const [version, setVersion] = useState<string>('1.0.0');
  const [buildNumber, setBuildNumber] = useState<string>('1');

  useEffect(() => {
    setSettings(getAppSettings());

    // Dynamic version fetch from device / native build config
    try {
      const appVersion = DeviceInfo.getVersion();
      const build = DeviceInfo.getBuildNumber();
      setVersion(appVersion);
      setBuildNumber(build);
    } catch {
      // Fallback if native module is linking in development
      setVersion('1.0.0');
    }
  }, []);

  const update = (partial: Partial<AppSettings>) => {
    const next = updateAppSettings(partial);
    setSettings(next);
  };

  const selectCaptureMode = (value: VoiceCaptureMode) => update({ captureMode: value });
  const selectTextMode = (value: TextDisplayMode) => update({ textDisplayMode: value });
  const selectConversationMode = (value: ConversationMode) => update({ conversationMode: value });
  const selectGender = (value: VoiceGender) => update({ voiceGender: value });
  const selectCharacter = (value: Character) => update({ character: value });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionTitle}>Voice Capture</Text>
      <OptionButton
        title="Auto Voice Capture"
        subtitle="Listen → AI → Reply → Listen"
        selected={settings.captureMode === 'auto'}
        onPress={() => selectCaptureMode('auto')}
      />
      <OptionButton
        title="Manual Voice Capture"
        subtitle="Tap the microphone to record"
        selected={settings.captureMode === 'manual'}
        onPress={() => selectCaptureMode('manual')}
      />

      <Text style={styles.sectionTitle}>Conversation Display</Text>
      <OptionButton
        title="Voice Only"
        subtitle="No conversation text"
        selected={settings.textDisplayMode === 'voiceOnly'}
        onPress={() => selectTextMode('voiceOnly')}
      />
      <OptionButton
        title="Voice + Text"
        subtitle="Show user and AI messages"
        selected={settings.textDisplayMode === 'voiceAndText'}
        onPress={() => selectTextMode('voiceAndText')}
      />

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>Text Input</Text>
          <Text style={styles.description}>Show a text input box</Text>
        </View>
        <Switch
          value={settings.textInputEnabled}
          onValueChange={value => update({ textInputEnabled: value })}
        />
      </View>

      <Text style={styles.sectionTitle}>AI Mode</Text>
      <OptionButton
        title="English Teacher"
        subtitle="Correct and practice English"
        selected={settings.conversationMode === 'teacher'}
        onPress={() => selectConversationMode('teacher')}
      />
      <OptionButton
        title="Best Friend"
        subtitle="Natural friendly conversation"
        selected={settings.conversationMode === 'friend'}
        onPress={() => selectConversationMode('friend')}
      />

      <Text style={styles.sectionTitle}>Voice</Text>
      <OptionButton
        title="Female"
        subtitle="Hannah"
        selected={settings.voiceGender === 'female'}
        onPress={() => selectGender('female')}
      />
      <OptionButton
        title="Male"
        subtitle="Troy"
        selected={settings.voiceGender === 'male'}
        onPress={() => selectGender('male')}
      />

      <Text style={styles.sectionTitle}>Character</Text>
      {(['friendly', 'teacher', 'calm', 'energetic'] as const).map(value => (
        <OptionButton
          key={value}
          title={value.charAt(0).toUpperCase() + value.slice(1)}
          selected={settings.character === value}
          onPress={() => selectCharacter(value)}
        />
      ))}

      {/* Dynamic Version Display */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>AI Voice Agent v{version} ({buildNumber})</Text>
        <Text style={styles.versionSubText}>Connected to Render Live API</Text>
      </View>
    </ScrollView>
  );
};

interface OptionButtonProps {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}

const OptionButton = ({ title, subtitle, selected, onPress }: OptionButtonProps) => (
  <TouchableOpacity style={[styles.option, selected && styles.optionSelected]} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.optionText}>
      <Text style={styles.label}>{title}</Text>
      {subtitle ? <Text style={styles.description}>{subtitle}</Text> : null}
    </View>
    <View style={[styles.radio, selected && styles.radioSelected]}>
      {selected ? <View style={styles.radioInner} /> : null}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0E12' },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '600', marginBottom: 25 },
  sectionTitle: { color: '#7F8CFF', fontSize: 14, fontWeight: '700', marginTop: 22, marginBottom: 10, textTransform: 'uppercase' },
  option: { minHeight: 65, borderRadius: 16, backgroundColor: '#15171D', borderWidth: 1, borderColor: '#252A36', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center' },
  optionSelected: { borderColor: '#4D68E8', backgroundColor: '#171C32' },
  optionText: { flex: 1 },
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: '500' },
  description: { color: '#8E95A6', fontSize: 12, marginTop: 4 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: '#555C6D', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#6D85FF' },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#6D85FF' },
  row: { minHeight: 65, borderRadius: 16, backgroundColor: '#15171D', borderWidth: 1, borderColor: '#252A36', paddingHorizontal: 16, marginBottom: 9, flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1 },
  versionContainer: { marginTop: 35, alignItems: 'center', justifyContent: 'center' },
  versionText: { color: '#7F8CFF', fontSize: 13, fontWeight: '600' },
  versionSubText: { color: '#555C6D', fontSize: 11, marginTop: 4 },
});

export default SettingsScreen;