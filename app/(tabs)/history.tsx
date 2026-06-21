import { View, Text } from 'react-native';
import { createStyleSheet, useStyles } from 'react-native-unistyles';

export default function HistoryScreen() {
  const { styles } = useStyles(stylesheet);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>History coming soon</Text>
    </View>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { ...theme.typography.bodyLarge, color: theme.colors.textMuted },
}));
