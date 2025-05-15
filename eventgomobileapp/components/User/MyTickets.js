import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { Card, Title, Paragraph, Button, Surface, Chip, Badge, ActivityIndicator, Divider, FAB } from 'react-native-paper';
import MyStyles, { COLORS } from '../styles/MyStyles';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authApis, endpoints } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MyUserContext } from '../../configs/MyContexts';
import { useNavigation } from '@react-navigation/native';

const MyTickets = () => {
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
      padding: 16,
    },
    header: {
      marginBottom: 20,
      alignItems: 'center',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: COLORS.primary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: COLORS.textSecondary,
      marginBottom: 16,
      textAlign: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    emptyText: {
      fontSize: 16,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
    ticketCard: {
      marginBottom: 16,
      borderRadius: 12,
      overflow: 'hidden',
    },
    ticketHeader: {
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eventTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: COLORS.text,
    },
    eventDate: {
      color: COLORS.textSecondary,
      marginTop: 4,
    },
    ticketDetails: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: COLORS.divider,
    },
    ticketRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    ticketLabel: {
      color: COLORS.textSecondary,
      fontSize: 14,
    },
    ticketValue: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: 'bold',
    },
    qrContainer: {
      alignItems: 'center',
      marginTop: 16,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: COLORS.divider,
    },
    qrImage: {
      width: 200,
      height: 200,
      marginBottom: 8,
    },
    qrText: {
      fontSize: 12,
      color: COLORS.textSecondary,
      textAlign: 'center',
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
    },
    chip: {
      marginRight: 8,
      marginBottom: 8,
    },
    statusChip: {
      position: 'absolute',
      top: 16,
      right: 16,
    },
    eventImage: {
      width: '100%',
      height: 150,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'flex-end',
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    overlayText: {
      color: 'white',
      padding: 16,
    },
    fab: {
      position: 'absolute',
      margin: 16,
      right: 0,
      bottom: 0,
      backgroundColor: COLORS.primary,
    },
    tabsContainer: {
      flexDirection: 'row',
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: COLORS.primary,
    },
    tabText: {
      color: COLORS.textSecondary,
    },
    activeTabText: {
      color: COLORS.primary,
      fontWeight: 'bold',
    },
  });

  const user = useContext(MyUserContext);
  const navigation = useNavigation();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log("No token found");
        return;
      }

      const authApi = authApis(token);
      const response = await authApi.get(endpoints['my-tickets']);
      
      if (response.status === 200) {
        // Process and organize tickets
        const ticketsWithDates = response.data.map(ticket => {
          const eventDate = new Date(ticket.event.event_date);
          return {
            ...ticket,
            parsedDate: eventDate
          };
        });

        setTickets(ticketsWithDates);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchTickets(true);
  };

  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', options);
  };

  const formatTime = (timeString) => {
    return timeString ? timeString.substring(0, 5) : '';
  };

  const getStatusChip = (ticket) => {
    const now = new Date();
    const eventDate = new Date(ticket.event.event_date);
    
    if (ticket.checked_in) {
      return (
        <Chip 
          icon="check-circle" 
          style={[styles.statusChip, { backgroundColor: COLORS.success }]} 
          textStyle={{ color: 'white' }}
        >
          Đã check-in
        </Chip>
      );
    } else if (now > eventDate) {
      return (
        <Chip 
          icon="calendar-check" 
          style={[styles.statusChip, { backgroundColor: COLORS.error }]} 
          textStyle={{ color: 'white' }}
        >
          Đã qua
        </Chip>
      );
    } else {
      return (
        <Chip 
          icon="calendar-clock" 
          style={[styles.statusChip, { backgroundColor: COLORS.primary }]} 
          textStyle={{ color: 'white' }}
        >
          Sắp diễn ra
        </Chip>
      );
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const now = new Date();
    const eventDate = ticket.parsedDate;
    
    if (activeTab === 'upcoming') {
      return eventDate >= now && !ticket.checked_in;
    } else if (activeTab === 'past') {
      return eventDate < now || ticket.checked_in;
    }
    return true;
  });

  const renderTicketItem = ({ item }) => {
    return (
      <Surface style={[styles.ticketCard, { elevation: 2 }]}>
        {item.event.image ? (
          <Image 
            source={{ uri: item.event.image }} 
            style={styles.eventImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.eventImage, { backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
            <MaterialCommunityIcons name="calendar-blank" size={50} color={COLORS.primary} />
          </View>
        )}
        
        {getStatusChip(item)}
        
        <View style={styles.ticketHeader}>
          <View>
            <Text style={styles.eventTitle}>{item.event.name}</Text>
            <Text style={styles.eventDate}>
              {formatDate(item.event.event_date)} • {formatTime(item.event.event_time)}
            </Text>
          </View>
        </View>
        
        <View style={styles.ticketDetails}>
          <View style={styles.ticketRow}>
            <Text style={styles.ticketLabel}>Mã vé:</Text>
            <Text style={styles.ticketValue}>{item.id}</Text>
          </View>
          
          <View style={styles.ticketRow}>
            <Text style={styles.ticketLabel}>Loại vé:</Text>
            <Text style={styles.ticketValue}>{item.ticket_type.name}</Text>
          </View>
          
          <View style={styles.ticketRow}>
            <Text style={styles.ticketLabel}>Giá:</Text>
            <Text style={styles.ticketValue}>{item.ticket_type.price.toLocaleString()} VNĐ</Text>
          </View>
          
          <View style={styles.ticketRow}>
            <Text style={styles.ticketLabel}>Địa điểm:</Text>
            <Text style={styles.ticketValue}>{item.event.venue || 'Chưa cập nhật'}</Text>
          </View>

          <View style={styles.chipContainer}>
            {item.event.categories && item.event.categories.map((category, index) => (
              <Chip 
                key={index} 
                style={[styles.chip, { backgroundColor: COLORS.primaryLight }]}
                textStyle={{ color: COLORS.primary }}
              >
                {category.name}
              </Chip>
            ))}
          </View>
        </View>
        
        {item.qr_image && (
          <View style={styles.qrContainer}>
            <Image 
              source={{ uri: item.qr_image }} 
              style={styles.qrImage}
              resizeMode="contain"
            />
            <Text style={styles.qrText}>Mã QR này được sử dụng để check-in tại sự kiện</Text>
          </View>
        )}
        
        <Divider />
        
        <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-around' }}>
          <Button 
            mode="outlined" 
            icon="information-outline"
            style={{ borderColor: COLORS.primary }}
            textColor={COLORS.primary}
            onPress={() => navigation.navigate('EventDetail', { id: item.event.id })}
          >
            Chi tiết
          </Button>
          
          <Button 
            mode="contained" 
            icon="google-maps"
            style={{ backgroundColor: COLORS.primary }}
            onPress={() => {
              if (item.event.google_maps_link) {
                Linking.openURL(item.event.google_maps_link);
              } else {
                alert('Không có thông tin địa điểm cho sự kiện này');
              }
            }}
          >
            Chỉ đường
          </Button>
        </View>
      </Surface>
    );
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="star-off" size={80} color={COLORS.primary} />
      <Text style={styles.emptyText}>
        {activeTab === 'upcoming' 
          ? 'Bạn chưa có vé cho sự kiện nào sắp tới' 
          : 'Bạn chưa tham gia sự kiện nào'}
      </Text>
      <Button        mode="contained" 
        icon="ticket-percent" 
        style={{ marginTop: 16, backgroundColor: COLORS.primary }}
        onPress={() => navigation.navigate('home')}
      >
        Khám phá sự kiện
      </Button>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vé của tôi</Text>
        <Text style={styles.subtitle}>Quản lý vé và check-in tại các sự kiện</Text>
      </View>
      
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Sắp diễn ra
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'past' && styles.activeTab]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
            Đã tham gia
          </Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 16, color: COLORS.textSecondary }}>Đang tải vé...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTicketItem}
          ListEmptyComponent={renderEmptyComponent}
          contentContainerStyle={{ flexGrow: 1 }}
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
        <FAB
        style={styles.fab}
        icon="calendar-search"
        color="white"
        onPress={() => navigation.navigate('home')}
      />
    </View>
  );
};

export default MyTickets;