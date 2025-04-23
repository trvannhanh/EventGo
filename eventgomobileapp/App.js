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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MyUserContext, MyDispatchContext } from './configs/MyContexts';
import MyUserReducer from "./components/reducers/MyUserReducer";
import { useReducer, useContext } from 'react';

const Stack = createNativeStackNavigator();
const StackNavigator = () => {
  return (
    <Stack.Navigator>
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
    <Tab.Navigator>
      <Tab.Screen name="Trang chủ" component={StackNavigator} options={{ title: 'Sự kiện', tabBarIcon: () => <Icon name="calendar" size={20} /> }} />
      {user === null ? (
        <>
          <Tab.Screen name="Đăng nhập" component={Login} options={{ title: 'Đăng nhập', tabBarIcon: () => <Icon name="login" size={20} /> }} />
          <Tab.Screen name="Đăng ký" component={Register} options={{ title: 'Đăng ký', tabBarIcon: () => <Icon name="account-plus" size={20} /> }} />
        </>
      ) : (
        <>
          <Tab.Screen name="Tài khoản" component={Profile} options={{ title: 'Tài khoản', tabBarIcon: () => <Icon name="account" size={20} /> }} />
          <Tab.Screen name="Vé" component={MyTickets} options={{ title: 'Đặt vé', tabBarIcon: () => <Icon name="ticket" size={20} /> }} />
        </>
      )}
    </Tab.Navigator>
  );
};

const App = () => {
  const [user, dispatch] = useReducer(MyUserReducer, null);

  return (
    <MyUserContext.Provider value={user}>
      <MyDispatchContext.Provider value={dispatch}>
        <NavigationContainer>
          <TabNavigator />
        </NavigationContainer>
      </MyDispatchContext.Provider>
    </MyUserContext.Provider>
  );
};

export default App;
