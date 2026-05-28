import type { ComponentProps } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS, TYPOGRAPHY } from '../theme/skeletal-tokens';
import type { TabParamList } from './types';
import ConfigStack from './stacks/ConfigStack';
import InicioStack from './stacks/InicioStack';
import LecturasStack from './stacks/LecturasStack';
import SyncStack from './stacks/SyncStack';

const Tab = createBottomTabNavigator<TabParamList>();

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const TAB_ICONS: Record<keyof TabParamList, IconName> = {
  Inicio: 'home',
  Lecturas: 'edit-note',
  Sincronizacion: 'sync',
  Config: 'settings',
};

const TAB_LABELS: Record<keyof TabParamList, string> = {
  Inicio: 'INICIO',
  Lecturas: 'LECTURAS',
  Sincronizacion: 'SINCRO',
  Config: 'CONFIG',
};

// ── Componente de ícono animado ────────────────────────────────────────────────

interface TabIconProps {
  name: IconName;
  label: string;
  focused: boolean;
}

function TabIcon({ name, label, focused }: TabIconProps) {
  // Controla cuánto "sube" el píldora con el ícono
  const translateY = useRef(new Animated.Value(focused ? -6 : 0)).current;
  // Escala del círculo: aparece grande cuando activo
  const scale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: focused ? -6 : 0,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
      Animated.spring(scale, {
        toValue: focused ? 1 : 0,
        useNativeDriver: true,
        tension: 120,
        friction: 8,
      }),
    ]).start();
  }, [focused, translateY, scale]);

  return (
    <View style={tabIconStyles.wrapper}>
      {focused ? (
        <Animated.View
          style={[
            tabIconStyles.bubble,
            { transform: [{ translateY }, { scale }] },
          ]}
        >
          <MaterialIcons name={name} size={22} color={COLORS.onPrimary} />
        </Animated.View>
      ) : (
        <MaterialIcons name={name} size={22} color={COLORS.onSurfaceVariant} />
      )}
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 72,
    paddingBottom: 14,
  },
  bubble: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  label: {
    ...TYPOGRAPHY.labelSm,
    fontSize: 9,
    marginTop: 2,
  },
  labelActiva: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  labelInactiva: {
    color: COLORS.onSurfaceVariant,
  },
  indicador: {
    height: 2,
    width: 20,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    marginTop: 2,
  },
});

// ── Navigator ─────────────────────────────────────────────────────────────────

export default function AppNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Inicio"
      screenOptions={({ route }) => {
        const routeName = route.name as keyof TabParamList;
        const iconName = TAB_ICONS[routeName] ?? 'circle';
        const label = TAB_LABELS[routeName] ?? routeName;

        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: COLORS.surfaceContainerLowest,
            borderTopWidth: 1,
            borderTopColor: COLORS.outlineVariant,
            height: 72,
            paddingBottom: 0,
            paddingTop: 0,
          },
          // Ocultamos label y background nativos — todo lo maneja TabIcon
          tabBarShowLabel: false,
          tabBarItemStyle: {
            paddingVertical: 0,
          },
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name={iconName} label={label} focused={focused} />
          ),
        };
      }}
    >
      <Tab.Screen name="Inicio" component={InicioStack} />
      <Tab.Screen name="Lecturas" component={LecturasStack} />
      <Tab.Screen name="Sincronizacion" component={SyncStack} />
      <Tab.Screen name="Config" component={ConfigStack} />
    </Tab.Navigator>
  );
}
