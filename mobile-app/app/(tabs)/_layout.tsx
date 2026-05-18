import { useTheme } from '../../context/ThemeContext';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../components/CustomTabBar';

export default function TabLayout() {
  const { colors, isDark, setTheme, theme } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: 'Exams',
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
        }}
      />
      <Tabs.Screen
        name="shukaansi"
        options={{
          title: 'Shukaansi',
          tabBarStyle: { display: 'none' }
        }}
      />
    </Tabs>
  );
}
