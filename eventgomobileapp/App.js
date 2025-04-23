import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from './components/Home/Home';
import EventDetail from './components/Home/EventDetail';
import Login from './components/User/Login';
import Register from './components/User/Register';
import Profile from './components/User/Profile';
import MyTickets from './components/User/MyTickets';
import BookTicket from './components/Home/BookTicket';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MyUserContext, MyDispatchContext } from './configs/MyContexts';
import MyUserReducer from "./components/reducers/MyUserReducer";
import { useReducer, useContext } from 'react';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import MyStyles from './components/styles/MyStyles';

const Stack = createNativeStackNavigator();
const StackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={Home} options={{ title: 'Trang chủ' }} />
      <Stack.Screen name="EventDetail" component={EventDetail} options={{ title: 'Chi tiết sự kiện' }} />
      <Stack.Screen name="BookTicket" component={BookTicket} options={{ title: 'Đặt vé' }} />
    </Stack.Navigator>
  );
};

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const user = useContext(MyUserContext);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...MyStyles.cardPastel,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          height: 64,
          borderTopWidth: 0,
          elevation: 8,
        },
        tabBarActiveTintColor: '#A49393',
        tabBarInactiveTintColor: '#BFD8D5',
        tabBarLabelStyle: { fontWeight: 'bold', fontSize: 13 },
      }}
    >
      <Tab.Screen name="Trang chủ" component={StackNavigator} options={{
        title: 'Sự kiện',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar" color={color} size={size} />
      }} />
      {user === null ? (
        <>
          <Tab.Screen name="Đăng nhập" component={Login} options={{
            title: 'Đăng nhập',
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="login" color={color} size={size} />
          }} />
          <Tab.Screen name="Đăng ký" component={Register} options={{
            title: 'Đăng ký',
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-plus" color={color} size={size} />
          }} />
        </>
      ) : (
        <>
          <Tab.Screen name="Tài khoản" component={Profile} options={{
            title: 'Tài khoản',
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account" color={color} size={size} />
          }} />
          <Tab.Screen name="Vé" component={MyTickets} options={{
            title: 'Đặt vé',
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="ticket-confirmation" color={color} size={size} />
          }} />
        </>
      )}
    </Tab.Navigator>
  );
};

const paperTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#A49393',
    accent: '#BFD8D5',
    background: '#F6E7E7',
    surface: '#FFF6F6',
    text: '#222',
    notification: '#BFD8D5',
  },
};

const App = () => {
  const [user, dispatch] = useReducer(MyUserReducer, null);

  return (
    <PaperProvider theme={paperTheme}>
      <MyUserContext.Provider value={user}>
        <MyDispatchContext.Provider value={dispatch}>
          <NavigationContainer theme={paperTheme}>
            <TabNavigator />
          </NavigationContainer>
        </MyDispatchContext.Provider>
      </MyUserContext.Provider>
    </PaperProvider>
  );
};

export default App;
