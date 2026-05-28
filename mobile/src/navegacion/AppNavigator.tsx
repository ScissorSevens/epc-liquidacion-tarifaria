import type { ComponentProps } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

interface TabIconProps {
  name: IconName;
  focused: boolean;
}

function TabIcon({ name, focused }: TabIconProps) {
  // translateY: burbuja sube suavemente
  const translateY = useRef(new Animated.Value(focused ? -6 : 0)).current;
  // scale: burbuja crece/decrece
  const scale = useRef(new Animated.Value(focused ? 1 : 0)).current;
  // opacidad burbuja (activo → 1, inactivo → 0)
  const bubbleOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  // opacidad ícono plano (activo → 0, inactivo → 1)
  const iconOpacity = useRef(new Animated.Value(focused ? 0 : 1)).current;

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
      {/* Ícono plano — visible cuando inactivo, se desvanece al activar */}
      <Animated.View style={[tabIconStyles.iconPlano, { opacity: iconOpacity }]}>
        <MaterialIcons name={name} size={22} color={COLORS.onSurfaceVariant} />
      </Animated.View>

      {/* Burbuja activa — aparece con fade+scale+translateY */}
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
  // Ícono plano: posición absoluta para que burbuja y plano compartan el mismo espacio
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
      screenOptions={({ route }) => {
        const routeName = route.name as keyof TabParamList;
        const iconName = TAB_ICONS[routeName] ?? 'circle';

        return {
          headerShown: false,
          // Transición suave entre pantallas
          animation: 'fade',
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
          tabBarIcon: ({ focused }: { focused: boolean }) => (
            <TabIcon name={iconName} focused={focused} />
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
