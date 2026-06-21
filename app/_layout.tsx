import '../unistyles';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" backgroundColor="#000000" />
      <Stack screenOptions={{ headerShown: false, contentStyle: styles.content }} />
    </GestureHandlerRootView>
  );
}

// Plain RN StyleSheet here — unistyles is initialised above, available to child components
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { backgroundColor: '#000000' },
});
