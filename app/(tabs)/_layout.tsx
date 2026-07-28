import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useBudgetStore } from '../../store/useBudgetStore';
import { t } from '../../lib/i18n';

export default function TabLayout() {
  // Subscribed purely to force a re-render when the language changes, since
  // t() reads a module-level variable rather than a Zustand field. Must be
  // `language` specifically — `symbol` only changes with country/currency,
  // not with an explicit language-only switch via setLanguage().
  useBudgetStore((s) => s.language);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0A0F',
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#00FF87',
        tabBarInactiveTintColor: '#4A5168',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="view-dashboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('history.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="history" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: t('trends.title'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="chart-bar" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
