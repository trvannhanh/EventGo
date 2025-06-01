import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Divider, Surface, Badge, IconButton } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApis, endpoints } from '../../configs/Apis';
import MyStyles, { COLORS } from '../styles/MyStyles';

const NotificationItem = ({ notification, onRead, navigation }) => {
  const formattedDate = () => {
    const date = new Date(notification.created_at);
    return date.toLocaleDateString('vi-VN', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const handlePress = () => {
    // Mark notification as read
    onRead(notification.id);    
    // If notification is related to an event, navigate to the event details
    if (notification.event) {
      navigation.navigate('Main', { 
        screen: 'home',
        params: {
          screen: 'EventDetail',
          params: { eventId: notification.event }
        }
      });
    }
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Surface style={[styles.notificationItem, notification.is_read ? styles.readNotification : {}]}>
        {!notification.is_read && <View style={styles.unreadIndicator} />}
        
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle} numberOfLines={1}>
              {notification.event_name || 'Thông báo từ EventGo'}
            </Text>
            <Text style={styles.notificationDate}>{formattedDate()}</Text>
          </View>
          
          <Text style={styles.notificationMessage} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>
      </Surface>
    </TouchableOpacity>
  );
};

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const navigation = useNavigation();

  const fetchNotifications = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setError('Bạn cần đăng nhập để xem thông báo');
        return;
      }

      const authApi = authApis(token);
      const response = await authApi.get(endpoints.myNotifications);
      setNotifications(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Không thể tải thông báo. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const handleMarkAsRead = async (id) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const authApi = authApis(token);
      await authApi.patch(endpoints.markNotificationRead(id));
      
      // Update local state
      setNotifications(prev => 
        prev.map(item => 
          item.id === id ? { ...item, is_read: true } : item
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const authApi = authApis(token);
      await authApi.patch(endpoints.markAllNotificationsRead);
      
      // Update all notifications to read
      setNotifications(prev => 
        prev.map(item => ({ ...item, is_read: true }))
      );
      
      Alert.alert('Thông báo', 'Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      Alert.alert('Lỗi', 'Không thể đánh dấu tất cả thông báo là đã đọc');
    }
  };

  const onRefresh = () => {
    fetchNotifications(true);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải thông báo...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={50} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thông báo</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <>
              <Badge style={styles.badge}>{unreadCount}</Badge>
              <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllAsRead}>
                <Text style={styles.markAllText}>Đánh dấu tất cả đã đọc</Text>
              </TouchableOpacity>
            </>          )}
        </View>
      </View>
      
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bell-off-outline" size={70} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>Bạn chưa có thông báo nào</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <NotificationItem 
              notification={item} 
              onRead={handleMarkAsRead}
              navigation={navigation}
            />
          )}
          ItemSeparatorComponent={() => <Divider style={styles.divider} />}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    elevation: 4,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: COLORS.primary,
    marginRight: 10,
  },
  markAllBtn: {
    padding: 8,
  },
  markAllText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  notificationItem: {
    padding: 16,
    backgroundColor: COLORS.surface,
    marginBottom: 1,
    flexDirection: 'row',
  },
  readNotification: {
    backgroundColor: COLORS.background,
    opacity: 0.9,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
    marginRight: 8,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontWeight: 'bold',
    color: COLORS.text,
    fontSize: 16,
    flex: 1,
  },
  notificationDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  notificationMessage: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  listContainer: {
    flexGrow: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: 16,
    color: COLORS.error,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});

export default Notifications;
