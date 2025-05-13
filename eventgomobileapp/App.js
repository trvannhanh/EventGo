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
import { Provider as PaperProvider, ActivityIndicator } from 'react-native-paper';
import MyStyles, { AppTheme, COLORS } from './components/styles/MyStyles';
import { View, Text, LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      <Stack.Screen name="ReviewList" component={ReviewList} options={{ title: 'Đánh giá sự kiện' }} />
      <Stack.Screen name="CreateEvent" component={CreateEvent} options={{ title: 'Tạo sự kiện' }} />
    </Stack.Navigator>
  );
};

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const user = useContext(MyUserContext);

  return (
    <Tab.Navigator      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: AppTheme.colors.surface,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          height: 64,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: 'rgba(0, 0, 0, 0.1)',
          shadowOffset: { width: 0, height: -3 },
          shadowRadius: 5
        },
        tabBarActiveTintColor: AppTheme.colors.primary,
        tabBarInactiveTintColor: AppTheme.colors.disabled,
        tabBarLabelStyle: { fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
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

const App = () => {
  const [user, dispatch] = useReducer(MyUserReducer, null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  useEffect(() => {
    // Check for cached user data and token
    const loadUserData = async () => {
      try {
        setIsLoading(true);
        const userData = await AsyncStorage.getItem('user');
        const token = await AsyncStorage.getItem('token');
        
        if (userData) {
          // Parse the stored user data
          const parsedUserData = JSON.parse(userData);
          
          // Ensure the token is included in the user data
          if (token && !parsedUserData.access_token) {
            parsedUserData.access_token = token;
          }
          
          dispatch({
            type: "LOGIN",
            payload: parsedUserData
          });
        } else if (token) {
          // If we have a token but no user data, try to fetch user data
          try {
            const authApi = authApis(token);
            const userResponse = await authApi.get(endpoints.currentUser);
            
            if (userResponse.data) {
              const newUserData = {
                ...userResponse.data,
                access_token: token
              };
              
              await AsyncStorage.setItem('user', JSON.stringify(newUserData));
              
              dispatch({
                type: "LOGIN",
                payload: newUserData
              });
            }
          } catch (userError) {
            console.error("Failed to fetch user data with token:", userError);
            // Token might be expired, remove it
            AsyncStorage.removeItem('token');
          }
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
      <PaperProvider theme={AppTheme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AppTheme.colors.background }}>
          <ActivityIndicator size="large" color={AppTheme.colors.primary} />
          <Text style={{ marginTop: 10, color: AppTheme.colors.text }}>Đang tải ứng dụng...</Text>
        </View>
      </PaperProvider>
    );
  }

  if (isError) {
    return (
      <PaperProvider theme={AppTheme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AppTheme.colors.background }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={60} color={AppTheme.colors.error} />
          <Text style={{ marginTop: 10, color: AppTheme.colors.text, fontSize: 16, fontWeight: 'bold' }}>
            Có lỗi xảy ra khi tải ứng dụng
          </Text>
          <Text style={{ marginTop: 5, color: AppTheme.colors.text, textAlign: 'center', paddingHorizontal: 30 }}>
            Vui lòng khởi động lại ứng dụng hoặc liên hệ hỗ trợ
          </Text>
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={AppTheme}>
      <MyUserContext.Provider value={user}>
        <MyDispatchContext.Provider value={dispatch}>
          <NavigationContainer theme={AppTheme}>
            <TabNavigator />
          </NavigationContainer>
        </MyDispatchContext.Provider>
      </MyUserContext.Provider>
    </PaperProvider>
  );
};

export default App;
