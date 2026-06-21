import { View, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export default function HistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>History coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...theme.typography.bodyLarge,
    color: theme.colors.textMuted,
  },
}));
