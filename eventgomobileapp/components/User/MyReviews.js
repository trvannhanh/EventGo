import React, { useEffect, useState, useContext } from 'react';
import { FlatList, View, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Card, Title, Paragraph, Avatar, Divider, IconButton, Button } from 'react-native-paper';
import { AntDesign } from '@expo/vector-icons';
import api, { endpoints, authApis } from '../../configs/Apis';
import MyStyles from '../styles/MyStyles';
import { MyUserContext } from "../../configs/MyContexts";

const MyReviews = ({ navigation }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = useContext(MyUserContext);
  
  useEffect(() => {
    // Chỉ lấy đánh giá khi người dùng đã đăng nhập
    if (!user) {
      setLoading(false);
      return;
    }
    
    const fetchMyReviews = async () => {
      try {
        // Sử dụng authApis thay vì api.get với headers
        const authApi = authApis(user.access_token);
        const res = await authApi.get(endpoints.myReviews);
        console.log("Raw reviews data:", JSON.stringify(res.data));
        const reviewsData = res.data || [];
        setReviews(reviewsData);
        
      } catch (err) {
        console.error("Lỗi khi tải đánh giá của tôi:", err);
        if (err.response && err.response.status === 401) {
          // Token hết hạn, cần đăng nhập lại
          Alert.alert(
            "Phiên đăng nhập hết hạn", 
            "Vui lòng đăng nhập lại để tiếp tục.",
            [
              { 
                text: "Đăng nhập", 
                onPress: () => navigation.navigate('Login') 
              }
            ]
          );
        } else {
          Alert.alert(
            "Lỗi", 
            "Không thể tải đánh giá của bạn. Vui lòng thử lại sau."
          );
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchMyReviews();
  }, [user, navigation]);
  
  const deleteReview = async (reviewId) => {
    Alert.alert(
      "Xác nhận",
      "Bạn có chắc chắn muốn xóa đánh giá này không?",
      [
        {
          text: "Hủy",
          style: "cancel"
        },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              // Sử dụng authApis thay vì api.delete với headers
              const authApi = authApis(user.access_token);
              await authApi.delete(endpoints.deleteReview(reviewId));
              
              // Cập nhật danh sách sau khi xóa
              setReviews(reviews.filter(review => review.id !== reviewId));
              Alert.alert("Thành công", "Đã xóa đánh giá thành công");
            } catch (err) {
              console.error("Lỗi khi xóa đánh giá:", err);
              if (err.response && err.response.status === 401) {
                // Token hết hạn, cần đăng nhập lại
                Alert.alert(
                  "Phiên đăng nhập hết hạn", 
                  "Vui lòng đăng nhập lại để tiếp tục.",
                  [
                    { 
                      text: "Đăng nhập", 
                      onPress: () => navigation.navigate('Login') 
                    }
                  ]
                );
              } else {
                Alert.alert(
                  "Lỗi", 
                  "Không thể xóa đánh giá. Vui lòng thử lại sau."
                );
              }
            }
          }
        }
      ]
    );
  };

  // Render item cho mỗi đánh giá
  const renderReviewItem = ({ item }) => (
    <Card style={{ marginBottom: 12, elevation: 2 }}>
      <Card.Content>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <TouchableOpacity 
            onPress={() => {
              if (item.event_id) {
                navigation.navigate('EventDetail', { eventId: item.event_id });
              } else {
                Alert.alert("Thông báo", "Không thể truy cập thông tin sự kiện này. Sự kiện có thể đã bị xóa.");
              }
            }}
            style={{ flex: 1 }}
          >
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#7FC8C2' }}>
              {item.event_name || "Sự kiện không xác định"}
            </Text>
          </TouchableOpacity>
          
          <IconButton
            icon="delete"
            size={20}
            color="#ff6b6b"
            onPress={() => deleteReview(item.id)}
          />
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 8 }}>
          {renderRatingStars(item.rating)}
          <Text style={{ marginLeft: 8, color: '#888' }}>
            {new Date(item.created_at).toLocaleDateString('vi-VN')}
          </Text>
        </View>
        
        <Paragraph>{item.comment}</Paragraph>
      </Card.Content>
    </Card>
  );
  
  // Render ra số sao dựa trên rating
  const renderRatingStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <AntDesign
          key={i}
          name={i <= rating ? "star" : "staro"}
          size={16}
          color={i <= rating ? "#FFD700" : "#C4C4C4"}
          style={{ marginRight: 2 }}
        />
      );
    }
    return <View style={{ flexDirection: 'row' }}>{stars}</View>;
  };

  // Nếu đang tải dữ liệu
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7FC8C2" />
        <Text style={{ marginTop: 16 }}>Đang tải đánh giá của bạn...</Text>
      </View>
    );
  }

  // Nếu chưa đăng nhập
  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Text style={{ fontSize: 18, marginBottom: 20, textAlign: 'center' }}>
          Vui lòng đăng nhập để xem đánh giá của bạn
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('Login')}
          style={{ backgroundColor: '#7FC8C2' }}
        >
          Đăng nhập
        </Button>
      </View>
    );
  }

  // Nếu không có đánh giá nào
  if (reviews.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        <Text style={{ fontSize: 18, marginBottom: 20, textAlign: 'center' }}>
          Bạn chưa có đánh giá nào
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('Home')}
          style={{ backgroundColor: '#7FC8C2' }}
        >
          Khám phá sự kiện
        </Button>
      </View>
    );
  }

  // Render danh sách đánh giá
  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#f5f5f5' }}>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderReviewItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
};

export default MyReviews;