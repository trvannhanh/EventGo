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
import ReviewList from './components/Home/ReviewList';
import MyReviews from './components/User/MyReviews';
import CreateEvent from './components/Home/CreateEvent';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MyUserContext, MyDispatchContext } from './configs/MyContexts';
import MyUserReducer from "./components/reducers/MyUserReducer";
import { useReducer, useContext } from 'react';
import { Provider as PaperProvider, DefaultTheme, ActivityIndicator } from 'react-native-paper';
import MyStyles from './components/styles/MyStyles';
import { View, Text, LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PaymentSuccess from './components/Home/PaymentSuccess';

// Bỏ qua một số cảnh báo không cần thiết
LogBox.ignoreLogs([
  'Asyncstorage has been extracted',
  'VirtualizedLists should never be nested',
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

const Stack = createNativeStackNavigator();
const StackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={Home} options={{ title: 'Trang chủ' }} />
      <Stack.Screen name="EventDetail" component={EventDetail} options={{ title: 'Chi tiết sự kiện' }} />
      <Stack.Screen name="BookTicket" component={BookTicket} options={{ title: 'Đặt vé' }} />
      <Stack.Screen name="PaymentSuccess" component={PaymentSuccess} options={{ title: 'Thanh toán Thành Công' }} />
      <Stack.Screen name="ReviewList" component={ReviewList} options={{ title: 'Đánh giá sự kiện' }} />
      <Stack.Screen name="CreateEvent" component={CreateEvent} options={{ title: 'Tạo sự kiện' }} />
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
      <Tab.Screen name="home" component={StackNavigator} options={{
        title: 'Sự kiện',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="calendar" color={color} size={size} />
      }} />
      {user === null ? (
        <>
          <Tab.Screen name="login" component={Login} options={{
            title: 'Đăng nhập',
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="login" color={color} size={size} />
          }} />
          <Tab.Screen name="register" component={Register} options={{
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
            title: 'Vé của tôi',
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="ticket-confirmation" color={color} size={size} />
          }} />
          <Tab.Screen name="Đánh giá" component={MyReviews} options={{
            title: 'Đánh giá',
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="star" color={color} size={size} />
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
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Check for cached user data
    const loadUserData = async () => {
      try {
        setIsLoading(true);
        const userData = await AsyncStorage.getItem('user');
        
        if (userData) {
          dispatch({
            type: "LOGIN",
            payload: JSON.parse(userData)
          });
        }
      } catch (error) {
        console.error("Failed to load user data:", error);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  if (isLoading) {
    return (
      <PaperProvider theme={paperTheme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: paperTheme.colors.background }}>
          <ActivityIndicator size="large" color={paperTheme.colors.primary} />
          <Text style={{ marginTop: 10, color: paperTheme.colors.text }}>Đang tải ứng dụng...</Text>
        </View>
      </PaperProvider>
    );
  }

  if (isError) {
    return (
      <PaperProvider theme={paperTheme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: paperTheme.colors.background }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={60} color="#FF6B6B" />
          <Text style={{ marginTop: 10, color: paperTheme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
            Có lỗi xảy ra khi tải ứng dụng
          </Text>
          <Text style={{ marginTop: 5, color: paperTheme.colors.text, textAlign: 'center', paddingHorizontal: 30 }}>
            Vui lòng khởi động lại ứng dụng hoặc liên hệ hỗ trợ
          </Text>
        </View>
      </PaperProvider>
    );
  }

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
