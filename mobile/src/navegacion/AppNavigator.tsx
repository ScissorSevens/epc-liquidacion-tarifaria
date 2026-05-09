import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import { BORDERS, COLORS, SPACING, TYPOGRAPHY } from '../theme/skeletal-tokens';
import type { TabParamList } from './types';
import ConfigStack from './stacks/ConfigStack';
import InicioStack from './stacks/InicioStack';
import LecturasStack from './stacks/LecturasStack';
import SyncStack from './stacks/SyncStack';

const Tab = createBottomTabNavigator<TabParamList>();

// Mapa de íconos MaterialIcons por nombre de tab
const TAB_ICONS: Record<keyof TabParamList, string> = {
  Inicio: 'home',
  Lecturas: 'edit-note',
  Sincronizacion: 'sync',
  Config: 'settings',
};

// Etiquetas visibles en la tab bar
const TAB_LABELS: Record<keyof TabParamList, string> = {
  Inicio: 'INICIO',
  Lecturas: 'LECTURAS',
  Sincronizacion: 'SINCRONIZACIÓN',
  Config: 'CONFIG',
};

export default function AppNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Inicio"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopWidth: BORDERS.thin.borderWidth,
          borderTopColor: BORDERS.thin.borderColor,
          height: 64,
          paddingBottom: SPACING.sm,
          paddingTop: SPACING.xs,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          ...TYPOGRAPHY.labelSm,
        },
        tabBarLabel: TAB_LABELS[route.name as keyof TabParamList] ?? route.name,
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <MaterialIcons
            name={TAB_ICONS[route.name as keyof TabParamList] ?? 'circle'}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Inicio" component={InicioStack} />
      <Tab.Screen name="Lecturas" component={LecturasStack} />
      <Tab.Screen name="Sincronizacion" component={SyncStack} />
      <Tab.Screen name="Config" component={ConfigStack} />
    </Tab.Navigator>
  );
}
