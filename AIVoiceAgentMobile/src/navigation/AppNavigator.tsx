import React from 'react';

import {
  Text,
} from 'react-native';

import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import AIVoiceScreen from '../screens/AIVoiceScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab =
  createBottomTabNavigator();

const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,

        tabBarStyle: {
          backgroundColor: '#111319',
          borderTopColor: '#252A36',
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },

        tabBarActiveTintColor:
          '#6D85FF',

        tabBarInactiveTintColor:
          '#777D8D',
      }}
    >
      <Tab.Screen
        name="AIVoice"
        component={
          AIVoiceScreen
        }
        options={{
          title: 'AI Voice',
          tabBarIcon: () => (
            <Text
              style={{
                fontSize: 20,
              }}
            >
              🎙
            </Text>
          ),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={
          SettingsScreen
        }
        options={{
          title: 'Settings',
          tabBarIcon: () => (
            <Text
              style={{
                fontSize: 20,
              }}
            >
              ⚙
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default AppNavigator;