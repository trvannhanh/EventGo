import React, { useEffect, useState, useContext, useCallback } from 'react';
import { FlatList, View, Text, ActivityIndicator, TouchableOpacity, Alert, StyleSheet, RefreshControl, ImageBackground } from 'react-native';
import { Card, Paragraph, IconButton, Button, Surface, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign, MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { endpoints, authApis } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MyUserContext } from "../../configs/MyContexts";
import { COLORS } from '../../components/styles/MyStyles';
import { useNavigation } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';

const MyReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = useContext(MyUserContext);
  const navigation = useNavigation();
    const fetchMyReviews = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else if (!refreshing) {
        setLoading(true);
      }

     
      
      const token = await AsyncStorage.getItem('token');
      
      
      if (!token) {
        console.log("No authentication token found");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      console.log("Using token to fetch reviews:", token ? "Token exists" : "No token");
      
      // Use authApis with token
      const authApi = authApis(token);
      const res = await authApi.get(endpoints.myReviews);
      console.log("Reviews API response:", res.data);
      const reviewsData = res.data || [];
      setReviews(reviewsData);
      
    } catch (err) {
      console.error("Error loading reviews:", err);
      if (err.response && err.response.status === 401) {
        // Token expired, need to login again
        Alert.alert(
          "Session expired", 
          "Please login again to continue.",
          [
            { 
              text: "Login", 
              onPress: () => navigation.navigate('Login') 
            }
          ]
        );
      } else {
        Alert.alert(
          "Error", 
          "Could not load your reviews. Please try again later."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchMyReviews();
    } else {
      setLoading(false);
    }
  }, [user]);
  
  // Pull-to-refresh functionality
  const onRefresh = useCallback(() => {
    if (user) {
      fetchMyReviews(true);
    }
  }, [user]);
  
  const deleteReview = async (reviewId) => {
    Alert.alert(
      "Confirm Deletion",
      "Are you sure you want to delete this review?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              if (!token) {
                Alert.alert("Login Required", "Please login to use this feature");
                navigation.navigate('Login');
                return;
              }
              
              const authApi = authApis(token);
              await authApi.delete(endpoints.deleteReview(reviewId));
              
              // Update the list after deletion
              setReviews(reviews.filter(review => review.id !== reviewId));
              Alert.alert("Success", "Review deleted successfully");
            } catch (err) {
              console.error("Error deleting review:", err);
              if (err.response && err.response.status === 401) {
                // Token expired, need to login again
                Alert.alert(
                  "Session expired", 
                  "Please login again to continue.",
                  [
                    { 
                      text: "Login", 
                      onPress: () => navigation.navigate('Login') 
                    }
                  ]
                );
              } else {
                Alert.alert(
                  "Error", 
                  "Could not delete review. Please try again later."
                );
              }
            }
          }
        }
      ]
    );
  };

  // Render rating stars based on rating value
  const renderRatingStars = (rating) => {
    return (
      <View style={{ flexDirection: 'row' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <AntDesign
            key={star}
            name={star <= rating ? "star" : "staro"}
            size={16}
            color={star <= rating ? "#FFD700" : COLORS.border}
            style={{ marginRight: 2 }}
          />
        ))}
      </View>
    );
  };

  // Render item for each review
  const renderReviewItem = ({ item }) => {
    const reviewDate = new Date(item.created_date || item.created_at);
    const formattedDate = reviewDate.toLocaleDateString('vi-VN');
    
    return (
      <Surface style={styles.reviewCard}>
        <Card.Content style={styles.reviewCardContent}>
          <View style={styles.reviewHeader}>
            <TouchableOpacity 
              onPress={() => {
                if (item.event_id) {
                  navigation.navigate('EventDetail', { eventId: item.event_id });
                } else {
                  Alert.alert("Notice", "Cannot access this event information. The event may have been deleted.");
                }
              }}
              style={styles.eventNameContainer}
            >
              <Text style={styles.eventName}>
                {item.event_name || "Unknown Event"}
              </Text>
                <Chip 
                icon="calendar" 
                style={styles.dateChip}
                textStyle={{ fontSize: 12, color: COLORS.primary }}
              >
                <Text>{formattedDate}</Text>
              </Chip>
            </TouchableOpacity>
            
            <IconButton
              icon="delete-outline"
              size={20}
              color={COLORS.error}
              style={styles.deleteButton}
              onPress={() => deleteReview(item.id)}
            />
          </View>
          
          <View style={styles.ratingContainer}>
            {renderRatingStars(item.rating)}
            <Text style={styles.ratingText}>{item.rating}/5</Text>
          </View>
          
          <Paragraph style={styles.reviewContent}>{item.comment}</Paragraph>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              if (item.event_id) {
                navigation.navigate('EventDetail', { eventId: item.event_id });
              }
            }}
          >
            <Ionicons name="eye" size={16} color={COLORS.primary} />
            <Text style={styles.actionButtonText}>View Event</Text>
          </TouchableOpacity>
        </Card.Content>
      </Surface>
    );
  };

  // Loading state
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your reviews...</Text>
      </View>
    );
  }
  // Not logged in state
  if (!user) {
    return (
      <View style={styles.loginContainer}>
        <Animatable.View 
          animation="fadeIn" 
          duration={800} 
          style={styles.loginCard}
        >
          <Animatable.View animation="pulse" iterationCount="infinite" duration={2000}>
            <MaterialCommunityIcons name="comment-alert-outline" size={90} color={COLORS.primary} />
          </Animatable.View>
          <Text style={styles.loginTitle}>Bạn chưa đăng nhập</Text>
          <Text style={styles.loginMessage}>
            Vui lòng đăng nhập để xem đánh giá của bạn về các sự kiện đã tham gia
          </Text>
          <Animatable.View animation="fadeInUp" delay={300}>              <Button 
              mode="contained" 
              onPress={() => navigation.navigate('Login')} 
              style={styles.loginButton}
              contentStyle={{ paddingVertical: 8 }}
              labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
              icon={({size, color}) => (
                <MaterialCommunityIcons name="login" size={size} color={color} />
              )}
            >
              <Text>Đăng nhập ngay</Text>
            </Button>
          </Animatable.View>
        </Animatable.View>
      </View>
    );
  }
    // Background image for header
  const backgroundImage = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxleHBsb3JlLWZlZWR8MXx8fGVufDB8fHx8&w=1000&q=80";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ImageBackground 
          source={{ uri: backgroundImage }}
          style={styles.headerBackground}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(94, 53, 177, 0.4)', 'rgba(94, 53, 177, 0.8)']}
            style={styles.headerGradient}
          >
            <Animatable.View 
              animation="fadeIn" 
              duration={1000} 
              style={styles.headerContent}
            >
              <Animatable.Text 
                animation="fadeInUp" 
                duration={700} 
                delay={300} 
                style={styles.title}
              >
                Đánh giá của tôi
              </Animatable.Text>
              <Animatable.Text 
                animation="fadeInUp" 
                duration={700} 
                delay={400} 
                style={styles.subtitle}
              >
                Quản lý tất cả đánh giá bạn đã gửi cho các sự kiện
              </Animatable.Text>
            </Animatable.View>
          </LinearGradient>
        </ImageBackground>
      </View>      <FlatList
        data={reviews}
        keyExtractor={item => item.id?.toString()}
        renderItem={renderReviewItem}
        contentContainerStyle={styles.listContainer}        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
            title="Đang làm mới..." // Add a title for the refresh indicator
            titleColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <Animatable.View 
            animation="fadeIn" 
            duration={800} 
            style={styles.emptyContainer}
          >
            <Animatable.View animation="pulse" iterationCount="infinite" duration={3000}>
              <MaterialCommunityIcons name="comment-off-outline" size={90} color={COLORS.primaryLight || '#6200ee80'} />
            </Animatable.View>
            <Text style={styles.emptyText}>
              Bạn chưa đánh giá sự kiện nào. Tham gia một sự kiện và chia sẻ trải nghiệm của bạn!
            </Text>
            <Animatable.View animation="fadeInUp" delay={400}>              <Button
                mode="contained"
                onPress={() => navigation.navigate('Home')}
                style={{ backgroundColor: COLORS.primary, marginTop: 20 }}
                contentStyle={{ paddingVertical: 8, paddingHorizontal: 15 }}
                icon={({size, color}) => (
                  <MaterialCommunityIcons name="calendar-search" size={size} color={color} />
                )}
              >
                <Text>Khám phá sự kiện</Text>
              </Button>
            </Animatable.View>
          </Animatable.View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#f5f5f5',
  },
  header: {
    width: '100%',
    overflow: 'hidden',
  },
  headerBackground: {
    height: 170,
    width: '100%',
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 170,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    marginBottom: 15,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  reviewCard: {
    marginBottom: 18,
    backgroundColor: COLORS.surface || '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: COLORS.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reviewCardContent: {
    padding: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventNameContainer: {
    flex: 1,
  },
  eventName: {
    fontWeight: 'bold',
    fontSize: 18,
    color: COLORS.primary || '#6200ee',
    marginBottom: 5,
  },
  dateChip: {
    backgroundColor: COLORS.lightPrimary || '#e6deff',
    alignSelf: 'flex-start',
    marginTop: 8,
    height: 26,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    backgroundColor: 'rgba(245, 245, 255, 0.6)',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ratingText: {
    marginLeft: 8,
    fontWeight: 'bold',
    color: COLORS.primary || '#6200ee',
  },
  reviewContent: {
    color: COLORS.text || '#212121',
    lineHeight: 22,
    fontSize: 15,
    backgroundColor: 'rgba(245, 245, 255, 0.4)',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary || '#6200ee',
  },
  deleteButton: {
    backgroundColor: COLORS.errorLight || '#ffebee',
    borderRadius: 20,
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 25,
    marginTop: 40,
  },
  emptyText: {
    fontSize: 17,
    color: COLORS.textSecondary || '#757575',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  loadingText: {
    marginTop: 16,
    color: COLORS.textSecondary || '#757575',
    fontSize: 16,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background || '#f5f5f5',
  },
  loginCard: {
    padding: 25,
    borderRadius: 20,
    width: '90%',
    alignItems: 'center',
    backgroundColor: COLORS.surface || '#fff',
  },
  loginMessage: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.text || '#212121',
    lineHeight: 24,
  },
  loginButton: {
    backgroundColor: COLORS.primary || '#6200ee',
    paddingHorizontal: 30,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.lightPrimary || '#e6deff',
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: COLORS.primary || '#6200ee',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: COLORS.error || '#b00020',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 16,
  },
});

export default MyReviews;
