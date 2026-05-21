import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useStore } from './src/store/useStore';
import { Mic, History } from 'lucide-react-native';

import LoginScreen from './src/screens/LoginScreen';
import OrderScreen from './src/screens/OrderScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: '#059669' }}>
      <Tab.Screen
        name="Order"
        component={OrderScreen}
        options={{
          tabBarIcon: ({ color }) => <Mic color={color} size={24} />
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ color }) => <History color={color} size={24} />
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const { userRole, fetchData } = useStore();

  useEffect(() => {
    // Only fetch data if the user is logged in
    if (userRole) {
      fetchData();
    }
  }, [userRole]);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!userRole ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}