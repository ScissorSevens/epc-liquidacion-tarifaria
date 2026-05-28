import type { ComponentProps } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { COLORS, RADIUS } from '../theme/skeletal-tokens';
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

// ── Componente de ícono animado ────────────────────────────────────────────────
// Usa useIsFocused() directamente para garantizar que las animaciones corran
// cuando React Navigation cambia el tab activo.

interface TabIconProps {
  name: IconName;
}

function TabIcon({ name }: TabIconProps) {
  const focused = useIsFocused();

  const translateY    = useRef(new Animated.Value(focused ? -6 : 0)).current;
  const scale         = useRef(new Animated.Value(focused ? 1 : 0.6)).current;
  const bubbleOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const iconOpacity   = useRef(new Animated.Value(focused ? 0 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: focused ? -6 : 0,
        useNativeDriver: true,
        tension: 120,
        friction: 9,
      }),
      Animated.spring(scale, {
        toValue: focused ? 1 : 0.6,
        useNativeDriver: true,
        tension: 120,
        friction: 9,
      }),
      Animated.timing(bubbleOpacity, {
        toValue: focused ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(iconOpacity, {
        toValue: focused ? 0 : 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, translateY, scale, bubbleOpacity, iconOpacity]);

  return (
    <View style={tabIconStyles.wrapper}>
      {/* Ícono plano — visible cuando inactivo */}
      <Animated.View style={[tabIconStyles.iconPlano, { opacity: iconOpacity }]}>
        <MaterialIcons name={name} size={22} color={COLORS.onSurfaceVariant} />
      </Animated.View>

      {/* Burbuja activa — fade + scale + translateY */}
      <Animated.View
        style={[
          tabIconStyles.bubble,
          {
            opacity: bubbleOpacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <MaterialIcons name={name} size={22} color={COLORS.onPrimary} />
      </Animated.View>
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
  iconPlano: {
    position: 'absolute',
    bottom: 14,
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
});

// ── Navigator ─────────────────────────────────────────────────────────────────

export default function AppNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Inicio"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surfaceContainerLowest,
          borderTopWidth: 1,
          borderTopColor: COLORS.outlineVariant,
          height: 72,
          paddingBottom: 0,
          paddingTop: 0,
        },
        tabBarShowLabel: false,
        tabBarItemStyle: {
          paddingVertical: 0,
        },
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={InicioStack}
        options={{ tabBarIcon: () => <TabIcon name="home" /> }}
      />
      <Tab.Screen
        name="Lecturas"
        component={LecturasStack}
        options={{ tabBarIcon: () => <TabIcon name="edit-note" /> }}
      />
      <Tab.Screen
        name="Sincronizacion"
        component={SyncStack}
        options={{ tabBarIcon: () => <TabIcon name="sync" /> }}
      />
      <Tab.Screen
        name="Config"
        component={ConfigStack}
        options={{ tabBarIcon: () => <TabIcon name="settings" /> }}
      />
    </Tab.Navigator>
  );
}
