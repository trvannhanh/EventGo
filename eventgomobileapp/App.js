import React, {
  useEffect,
  useState,
  useRef,
  useReducer,
  useContext,
} from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Home from "./components/Home/Home";
import EventDetail from "./components/Home/EventDetail";
import Login from "./components/User/Login";
import Register from "./components/User/Register";
import Profile from "./components/User/Profile";
import MyTickets from "./components/User/MyTickets";
import MyOrders from "./components/User/MyOrders";
import MyEvents from "./components/User/MyEvents";
import BookTicket from "./components/Home/BookTicket";
import ReviewList from "./components/Home/ReviewList";
import ReplyToReview from "./components/Home/ReplyToReview";
import MyReviews from "./components/User/MyReviews";
import CreateEvent from "./components/Home/CreateEvent";
import CheckIn from "./components/Home/CheckIn";
import NotificationsScreen from "./components/User/Notifications";
import AnalyticsScreen from "./components/Dashboard/AnalyticsScreen"; 
import EventDetailAnalytics from "./components/Dashboard/EventDetailAnalytics";
import ComparativeAnalytics from "./components/Dashboard/ComparativeAnalytics"; 
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MyUserContext, MyDispatchContext } from "./configs/MyContexts";
import MyUserReducer from "./components/reducers/MyUserReducer";
import {
  Provider as PaperProvider,
  ActivityIndicator,
} from "react-native-paper";
import MyStyles, { AppTheme, COLORS } from "./components/styles/MyStyles";
import { View, Text, LogBox } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as Constants from "expo-constants";
// Import Firebase configuration to initialize Firebase
import { app } from "./configs/firebase";

import { authApis, endpoints } from "./configs/Apis";
// Import the new notification handler
import { initializeNotifications } from "./configs/notificationHandler";
import Chat from "./components/Home/Chat";

// Bỏ qua một số cảnh báo không cần thiết
LogBox.ignoreLogs([
  "Asyncstorage has been extracted",
  "VirtualizedLists should never be nested",
  "ViewPropTypes will be removed",
  "ColorPropType will be removed",
]);

const Stack = createNativeStackNavigator();
const StackNavigator = ({ navigation, route }) => {
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      // Reset stack to Home screen when the tab is focused
      if (navigation.getState().index > 0) {
        navigation.reset({
          index: 0,
          routes: [{ name: "Home" }],
        });
      }
    });

    return unsubscribe;
  }, [navigation]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="EventDetail" component={EventDetail} />
      <Stack.Screen name="BookTicket" component={BookTicket} />
      <Stack.Screen name="ReviewList" component={ReviewList} />
      <Stack.Screen name="ReplyToReview" component={ReplyToReview} />
      <Stack.Screen name="CreateEvent" component={CreateEvent} />
      <Stack.Screen name="CheckIn" component={CheckIn} />
      <Stack.Screen name="Chat" component={Chat} />
    </Stack.Navigator>
  );
};

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const user = useContext(MyUserContext);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: AppTheme.colors.surface,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          height: 64,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: "rgba(0, 0, 0, 0.1)",
          shadowOffset: { width: 0, height: -3 },
          shadowRadius: 5,
        },
        tabBarActiveTintColor: AppTheme.colors.primary,
        tabBarInactiveTintColor: AppTheme.colors.disabled,
        tabBarLabelStyle: { fontWeight: "bold", fontSize: 12, marginBottom: 4 },
        tabBarLabel: ({ focused, color }) => {
          let label;
          if (route.name === "home") {
            label = "Sự kiện";
          } else if (route.name === "login") {
            label = "Đăng nhập";
          } else if (route.name === "register") {
            label = "Đăng ký";
          } else if (route.name === "account") {
            label = "Tài khoản";
          } else if (route.name === "tickets") {
            label =
              user && user.role === "organizer"
                ? "Sự kiện của tôi"
                : "Vé của tôi";
          } else if (route.name === "reviews") {
            label = "Đánh giá";
          } else if (route.name === "analytics") {
            // Add label for Analytics
            label = "Thống kê";
          }
          return (
            <Text
              style={{
                color,
                fontWeight: focused ? "bold" : "normal",
                fontSize: 12,
              }}
            >
              {label}
            </Text>
          );
        },
      })}
    >
      <Tab.Screen
        name="home"
        component={StackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar" color={color} size={size} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Navigate to home tab and reset its stack
            navigation.navigate("home", {
              screen: "Home",
            });
          },
        })}
      />
      {user === null ? (
        <>
          <Tab.Screen
            name="login"
            component={Login}
            options={{
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons
                  name="login"
                  color={color}
                  size={size}
                />
              ),
            }}
          />
          <Tab.Screen
            name="register"
            component={Register}
            options={{
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons
                  name="account-plus"
                  color={color}
                  size={size}
                />
              ),
            }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="account"
            component={Profile}
            options={{
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons
                  name="account"
                  color={color}
                  size={size}
                />
              ),
            }}
          />
          {user.role !== "admin" && (
            <Tab.Screen
              name="tickets"
              component={
                user && user.role === "organizer" ? MyEvents : MyOrders
              }
              options={{
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons
                    name={
                      user && user.role === "organizer"
                        ? "calendar-text"
                        : "ticket-confirmation"
                    }
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
          )}
          {user.role !== "organizer" && user.role !== "admin" && (
            <Tab.Screen
              name="reviews"
              component={MyReviews}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons
                    name="star"
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
          )}
          {(user.role === "organizer" || user.role === "admin") && (
            <Tab.Screen
              name="analytics"
              component={AnalyticsScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <MaterialCommunityIcons
                    name="chart-line"
                    color={color}
                    size={size}
                  />
                ),
              }}
            />
          )}
        </>
      )}
    </Tab.Navigator>
  );
};

const App = () => {
  const [user, dispatch] = useReducer(MyUserReducer, null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const navigationRef = useRef();
  // Create a ref for the notification system
  const notificationSystem = useRef(null);

  // Make notification system globally accessible to be used in other components
  global.notificationSystem = notificationSystem;

  // Effect để thiết lập push notifications
  useEffect(() => {
    let isMounted = true;

    // Đợi đến khi navigation reference được khởi tạo
    const setupNotifications = async () => {
      try {
        // Initialize the notification system with the current user token
        const authToken = user?.access_token || null;

        // Chỉ khởi tạo khi navigation đã sẵn sàng
        if (navigationRef.current) {
          console.log(
            "Navigation ref is ready, initializing notification system"
          );
          // Create notification system with current navigation reference
          const notificationHandler = await initializeNotifications(
            navigationRef.current,
            authToken
          );

          if (isMounted) {
            notificationSystem.current = notificationHandler;

            // Make notification handler immediately available to other components
            global.notificationSystem = { current: notificationHandler };

            console.log("Notification system initialized globally");
          }

          // Update token on server if logged in but token wasn't sent before
          if (user && user.access_token) {
            const tokenSent = await AsyncStorage.getItem(
              "pushTokenSentToServer"
            );
            if (tokenSent !== "true") {
              await notificationHandler.updateServerToken(user.access_token);
            }
          }

          // Show a welcome notification on first launch to verify system is working
          const isFirstLaunch = await AsyncStorage.getItem(
            "firstLaunchNotificationShown"
          );
          if (!isFirstLaunch && notificationHandler) {
            // Add a slight delay to ensure navigation is fully initialized
            setTimeout(async () => {
              if (isMounted && notificationHandler) {
                try {
                  // Use event notification format to show the welcome message
                  const welcomeData = {
                    name: "EventGo",
                    id: "welcome",
                    date: new Date().toISOString(),
                    location: "Ứng dụng EventGo",
                  };

                  // Show welcome notification with event-style formatting
                  await notificationHandler.showEventNotification(
                    welcomeData,
                    false
                  );
                  await AsyncStorage.setItem(
                    "firstLaunchNotificationShown",
                    "true"
                  );
                } catch (notifError) {
                  console.error(
                    "Error showing welcome notification:",
                    notifError
                  );
                }
              }
            }, 3000);
          }
        } else {
          console.warn(
            "Navigation reference not ready when initializing notifications"
          );

          // Retry after navigation reference is ready
          setTimeout(async () => {
            if (navigationRef.current && isMounted) {
              const notificationHandler = await initializeNotifications(
                navigationRef.current,
                authToken
              );
              notificationSystem.current = notificationHandler;
            }
          }, 2000);
        }
      } catch (error) {
        console.error("Error setting up notification system:", error);
      }
    };

    // Đợi một chút để NavigationContainer khởi tạo hoàn toàn trước khi cài đặt thông báo
    const timer = setTimeout(() => {
      if (isMounted) {
        setupNotifications();
      }
    }, 1000);

    // Cleanup
    return () => {
      clearTimeout(timer);
      isMounted = false;
      if (notificationSystem.current) {
        notificationSystem.current.cleanup();
      }
    };
  }, [user]); // Re-run when user changes to update server with token

  // Effect để khởi tạo user
  useEffect(() => {
    // Đây là effect cho việc khởi tạo user

    // Check for cached user data and token
    const loadUserData = async () => {
      try {
        setIsLoading(true);
        const userData = await AsyncStorage.getItem("user");
        const token = await AsyncStorage.getItem("token");

        if (userData) {
          // Parse the stored user data
          const parsedUserData = JSON.parse(userData);

          // Ensure the token is included in the user data
          if (token && !parsedUserData.access_token) {
            parsedUserData.access_token = token;
          }
          dispatch({
            type: "LOGIN",
            payload: parsedUserData,
          });
        } else if (token) {
          try {
            const authApi = authApis(token);

            const userResponse = await authApi.get(endpoints.currentUser);

            if (userResponse.data) {
              const newUserData = {
                ...userResponse.data,
                access_token: token,
              };

              await AsyncStorage.setItem("user", JSON.stringify(newUserData));

              dispatch({
                type: "LOGIN",
                payload: newUserData,
              });
            }
          } catch (userError) {
            console.error("Failed to fetch user data with token:", userError);
            // Token might be expired, remove it
            AsyncStorage.removeItem("token");
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
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: AppTheme.colors.background,
          }}
        >
          <ActivityIndicator size="large" color={AppTheme.colors.primary} />
          <Text style={{ marginTop: 10, color: AppTheme.colors.text }}>
            Đang tải ứng dụng...
          </Text>
        </View>
      </PaperProvider>
    );
  }

  if (isError) {
    return (
      <PaperProvider theme={AppTheme}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: AppTheme.colors.background,
          }}
        >
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={60}
            color={AppTheme.colors.error}
          />
          <Text
            style={{
              marginTop: 10,
              color: AppTheme.colors.text,
              fontSize: 16,
              fontWeight: "bold",
            }}
          >
            Có lỗi xảy ra khi tải ứng dụng
          </Text>
          <Text
            style={{
              marginTop: 5,
              color: AppTheme.colors.text,
              textAlign: "center",
              paddingHorizontal: 30,
            }}
          >
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
          <NavigationContainer ref={navigationRef} theme={AppTheme}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Main" component={TabNavigator} />
              <Stack.Screen
                name="Notifications"
                component={NotificationsScreen}
                options={{
                  headerShown: true,
                  title: "Thông báo",
                  headerTintColor: AppTheme.colors.primary,
                }}
              />
              <Stack.Screen
                name="EventDetailAnalytics"
                component={EventDetailAnalytics}
                options={{
                  headerShown: true,
                  title: "Phân tích chi tiết",
                  headerTintColor: AppTheme.colors.primary,
                }}
              />
              <Stack.Screen
                name="ComparativeAnalytics"
                component={ComparativeAnalytics}
                options={{
                  headerShown: true,
                  title: "So sánh sự kiện",
                  headerTintColor: AppTheme.colors.primary,
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </MyDispatchContext.Provider>
      </MyUserContext.Provider>
    </PaperProvider>
  );
};

export default App;
