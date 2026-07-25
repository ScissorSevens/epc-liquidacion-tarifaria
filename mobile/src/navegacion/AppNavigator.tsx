import type { ComponentProps } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useReducedMotion } from '../hooks/useReducedMotion';
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
  label: string;
}

function TabIcon({ name, label }: TabIconProps) {
  const focused = useIsFocused();
  // Regla de impecable: "Reduced motion is not optional". Si el OS tiene
  // Reduce Motion activado, los iconos cambian de foco instantaneamente
  // (sin spring ni timing) — crossfade instantaneo.
  const reducedMotion = useReducedMotion();

  const translateY    = useRef(new Animated.Value(focused ? -6 : 0)).current;
  const scale         = useRef(new Animated.Value(focused ? 1 : 0.6)).current;
  const bubbleOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const iconOpacity   = useRef(new Animated.Value(focused ? 0 : 1)).current;

  useEffect(() => {
    if (reducedMotion) {
      // Sin transicion — seteamos el valor final directamente. El
      // `useRef` arriba ya inicializa el estado de mount correctamente;
      // esto cubre los cambios de `focused` mientras reducedMotion esta
      // activo.
      translateY.setValue(focused ? -6 : 0);
      scale.setValue(focused ? 1 : 0.6);
      bubbleOpacity.setValue(focused ? 1 : 0);
      iconOpacity.setValue(focused ? 0 : 1);
      return;
    }

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
  }, [focused, reducedMotion, translateY, scale, bubbleOpacity, iconOpacity]);

  return (
    <View style={tabIconStyles.wrapper}>
      {/* Ícono plano — visible cuando inactivo */}
      <Animated.View style={[tabIconStyles.iconPlano, { opacity: iconOpacity }]}>
        <MaterialIcons name={name} size={22} color={COLORS.onSurfaceVariant} />
        <Text style={tabIconStyles.label} numberOfLines={1}>{label}</Text>
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

      {/* Label bajo la burbuja cuando activo */}
      <Animated.Text
        style={[tabIconStyles.label, tabIconStyles.labelFocused, { opacity: bubbleOpacity }]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 80,
    paddingBottom: 10,
  },
  iconPlano: {
    position: 'absolute',
    bottom: 10,
    alignItems: 'center',
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
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.onSurfaceVariant,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  labelFocused: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

// ── Navigator ─────────────────────────────────────────────────────────────────

interface Props {
  readonly onLogoutRequested: () => void;
}

export default function AppNavigator({ onLogoutRequested }: Props) {
  return (
    <Tab.Navigator
      initialRouteName="Inicio"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surfaceContainerLowest,
          borderTopWidth: 1,
          borderTopColor: COLORS.outlineVariant,
          height: 80,
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
        options={{ tabBarIcon: () => <TabIcon name="home" label="Inicio" /> }}
      />
      <Tab.Screen
        name="Lecturas"
        component={LecturasStack}
        options={{ tabBarIcon: () => <TabIcon name="edit-note" label="Lecturas" /> }}
      />
      <Tab.Screen
        name="Sincronizacion"
        component={SyncStack}
        options={{ tabBarIcon: () => <TabIcon name="sync" label="Sincro" /> }}
      />
      <Tab.Screen
        name="Config"
        options={{ tabBarIcon: () => <TabIcon name="person" label="Perfil" /> }}
      >
        {() => <ConfigStack onLogoutRequested={onLogoutRequested} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
