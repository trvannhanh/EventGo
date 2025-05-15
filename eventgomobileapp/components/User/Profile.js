import React, { useContext, useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, Image, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MyStyles, { COLORS } from '../styles/MyStyles';
import { MyUserContext, MyDispatchContext } from '../../configs/MyContexts';
import * as ImagePicker from 'expo-image-picker';
import { authApis, endpoints } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, TextInput, Card, Avatar, Title, Paragraph, Surface, Divider, List, IconButton, Chip } from 'react-native-paper';
import { MaterialCommunityIcons, Ionicons, FontAwesome5, Feather, MaterialIcons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';

export default function Profile({ navigation }) {
    const { width } = Dimensions.get('window');
    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: COLORS.background,
        },        headerContainer: {
            height: 320,
            position: 'relative',
        },
        notificationButton: {
            position: 'absolute',
            top: 50,
            right: 20,
            zIndex: 999,
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: 25,
            width: 45,
            height: 45,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 5,
        },
        notificationBadge: {
            position: 'absolute',
            top: -5,
            right: -5,
            backgroundColor: COLORS.error,
            borderRadius: 15,
            minWidth: 20,
            height: 20,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: '#fff',
        },
        notificationBadgeText: {
            color: '#fff',
            fontSize: 10,
            fontWeight: 'bold',
            textAlign: 'center',
        },
        headerBackground: {
            width: '100%',
            height: 320,
            position: 'absolute',
            top: 0,
        },
        gradientOverlay: {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 320,
            zIndex: 1,
        },
        headerContentWrapper: {
            position: 'relative', 
            zIndex: 2,
            height: '100%',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: 20,
        },
        headerContent: {
            alignItems: 'center',
            position: 'relative',
            bottom: 0,
            marginTop: 'auto',
        },
        avatarContainer: {
            position: 'relative',
            marginBottom: 15,
            alignItems: 'center',
        },
        avatar: {
            width: 120,
            height: 120,
            borderRadius: 60,
            borderWidth: 3,
            borderColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            elevation: 10,
        },
        photoButton: {
            position: 'absolute',
            bottom: 5,
            right: 0,
            backgroundColor: COLORS.accent,
            borderRadius: 24,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 5,
            borderWidth: 2,
            borderColor: '#fff',
        },
        profileImagePlaceholder: {
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(230, 230, 255, 0.8)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            elevation: 10,
        },
        title: {
            fontSize: 28,
            fontWeight: 'bold',
            color: '#fff',
            marginBottom: 2,
            textShadowColor: 'rgba(0, 0, 0, 0.3)',
            textShadowOffset: { width: 1, height: 1 },
            textShadowRadius: 3,
        },
        subtitle: {
            fontSize: 16,
            color: '#fff',
            marginBottom: 8,
            textShadowColor: 'rgba(0, 0, 0, 0.2)',
            textShadowOffset: { width: 0.5, height: 0.5 },
            textShadowRadius: 2,
        },
        userRoleChip: {
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            borderRadius: 20,
            paddingVertical: 5,
            paddingHorizontal: 15,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        userRoleText: {
            color: '#fff',
            fontWeight: '600',
            marginLeft: 6,
            fontSize: 14,
            textShadowColor: 'rgba(0, 0, 0, 0.2)',
            textShadowOffset: { width: 0.5, height: 0.5 },
            textShadowRadius: 1,
        },        contentContainer: {
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 40,
            marginTop: -30,
        },
        card: {
            marginBottom: 16,
            padding: 0,
            borderRadius: 18,
            overflow: 'hidden',
            elevation: 4,
            backgroundColor: COLORS.surface,
            shadowColor: COLORS.shadow,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
        },
        cardHeader: {
            paddingHorizontal: 20,
            paddingTop: 15,
            paddingBottom: 12,
            backgroundColor: COLORS.primaryLight + '20',
            borderBottomWidth: 1,
            borderBottomColor: COLORS.primaryLight + '40',
        },
        sectionTitle: {
            fontSize: 20,
            fontWeight: 'bold',
            color: COLORS.primary,
            marginLeft: 10,
        },
        sectionIcon: {
            color: COLORS.primary,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        cardContent: {
            padding: 20,
        },        
        infoItem: {
            marginBottom: 15,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(245, 245, 255, 0.5)',
            padding: 12,
            borderRadius: 4,
            borderWidth: 0.5,
            borderColor: 'rgba(200, 200, 200, 0.5)',
            shadowColor: COLORS.shadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 1,
            elevation: 0.5,
        },
        infoLabel: {
            fontSize: 15,
            color: COLORS.textSecondary,
            width: 80,
            fontWeight: '500',
        },
        infoValue: {
            fontSize: 16,
            color: COLORS.text,
            flex: 1,
            fontWeight: '600',
        },
        infoIcon: {
            marginRight: 15,
            color: COLORS.primary,
        },
        inputContainer: {
            marginBottom: 20,
        },
        input: {
            backgroundColor: 'rgba(245, 245, 255, 0.7)',
            marginBottom: 12,
            borderRadius: 12,
        },
        buttonContainer: {
            marginTop: 25,
        },
        updateButton: {
            backgroundColor: COLORS.primary,
            marginBottom: 16,
            borderRadius: 14,
            paddingVertical: 8,
            elevation: 2,
        },
        logoutButton: {
            backgroundColor: 'rgba(255, 235, 235, 0.8)',
            borderRadius: 14,
            paddingVertical: 8,
            borderWidth: 1.5,
            borderColor: COLORS.error,
        },
        logoutText: {
            color: COLORS.error,
            fontWeight: 'bold',
        },        profileImagePlaceholder: {
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(230, 230, 255, 0.8)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
            elevation: 10,
        },
        notLoggedInContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 25,
            backgroundColor: COLORS.background,
        },
        notLoggedInCard: {
            padding: 30,
            borderRadius: 24,
            width: '90%',
            alignItems: 'center',
            backgroundColor: COLORS.surface,
            elevation: 5,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
        },
        notLoggedInTitle: {
            fontSize: 26,
            fontWeight: 'bold',
            color: COLORS.primary,
            marginTop: 15,
            marginBottom: 10,
        },
        notLoggedInSubtitle: {
            fontSize: 16,
            color: COLORS.textSecondary,
            marginBottom: 25,
            textAlign: 'center',
            lineHeight: 22,
        },
        loginButton: {
            backgroundColor: COLORS.primary,
            paddingVertical: 12,
            paddingHorizontal: 30,
            borderRadius: 14,
            elevation: 3,
            shadowColor: COLORS.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
        },
        statsContainer: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            padding: 15,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: 16,
            marginTop: 20,
            marginBottom: 10,
            marginHorizontal: 15,
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        statItem: {
            alignItems: 'center',
            justifyContent: 'center',
            padding: 10,
            minWidth: 80,
        },
        statValue: {
            fontSize: 22,
            fontWeight: 'bold',
            color: COLORS.primary,
        },
        statLabel: {
            fontSize: 13,
            color: COLORS.textSecondary,
            marginTop: 4,
        },
        statDivider: {
            width: 1,
            height: '70%',
            backgroundColor: COLORS.border + '80',
        },
        badgesHeader: {
            paddingHorizontal: 20,
            paddingTop: 15,
            paddingBottom: 10,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        badgesContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-around',
            padding: 15,
        },
        badgeItem: {
            alignItems: 'center',
            width: width / 4 - 20,
            marginBottom: 15,
        },
        badgeIcon: {
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: COLORS.primaryLight + '40',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
        },
        badgeName: {
            fontSize: 12,
            textAlign: 'center',
            color: COLORS.textSecondary,
        },        footerContainer: {
            alignItems: 'center',
            marginTop: 10,
            marginBottom: 20,
        },
        versionText: {
            fontSize: 12,
            color: COLORS.textSecondary,
        },
        settingItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            marginBottom: 10,
            backgroundColor: 'rgba(245, 245, 255, 0.5)',
            padding: 15,
            borderRadius: 12,
            borderWidth: 0.5,
            borderColor: 'rgba(200, 200, 200, 0.3)',
        },
        settingIconContainer: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(230, 230, 255, 0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 15,
        },
        settingContent: {
            flex: 1,
        },
        settingTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: COLORS.text,
            marginBottom: 4,
        },
        settingDescription: {
            fontSize: 13,
            color: COLORS.textSecondary,
        },
    });
      const user = useContext(MyUserContext);
    const dispatch = useContext(MyDispatchContext);
    const [phone, setPhone] = useState('');
    const [avatar, setAvatar] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [avatarKey, setAvatarKey] = useState(Date.now());    const [userData, setUserData] = useState(null);
    const [showStats, setShowStats] = useState(true);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
    
    // Lấy số lượng thông báo chưa đọc mỗi khi màn hình được focus
    useFocusEffect(
        useCallback(() => {
            const fetchNotificationsCount = async () => {
                try {
                    const token = await AsyncStorage.getItem('token');
                    if (!token) return;
                    
                    const authApi = authApis(token);
                    const response = await authApi.get(endpoints.myNotifications);
                    const unreadCount = response.data.filter(notification => !notification.is_read).length;
                    setUnreadNotificationsCount(unreadCount);
                } catch (error) {
                    console.error("Lỗi khi lấy thông báo:", error);
                }
            };
            
            if (user) {
                fetchNotificationsCount();
            }
            
            return () => {
                // Cleanup nếu cần
            };
        }, [user])
    );
    
    // Thêm hàm lấy thông tin người dùng từ API
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) return;
                const authApi = authApis(token);
                const response = await authApi.get(endpoints.currentUser);
                setUserData(response.data);
                setPhone(response.data.phone || '');
                setAvatar(response.data.avatar || null);
            } catch (error) {
                console.error("Lỗi khi lấy thông tin người dùng:", error);
            }
        };
        if (user) {
            setPhone(user.phone || '');
            setAvatar(user.avatar || null);
            fetchUserData();
        }
    }, [user]);

    // Helper function để tạo URL chính xác cho avatar
    const getAvatarUri = (avatarPath) => {
        if (!avatarPath) return null;
        
        // Nếu là URI cục bộ từ thư viện ảnh (file:// hoặc content://)
        if (avatarPath.startsWith('file://') || avatarPath.startsWith('content://')) {
            return avatarPath;
        }
        
        // Nếu đã là URL đầy đủ
        if (avatarPath.startsWith('http')) {
            return avatarPath;
        }
        
        // Nếu là đường dẫn relative trong Cloudinary
        if (avatarPath.includes('cloudinary') || avatarPath.includes('upload')) {
            return `https://res.cloudinary.com/dqpkxxzaf/${avatarPath}`;
        }
        
        // Nếu chỉ là tên file (trường hợp từ media trong Django)
        return `http://192.168.1.41:8000/media/${avatarPath}`;
    };    const handleLogout = async () => {
        try {
            Alert.alert(
                'Xác nhận đăng xuất', 
                'Bạn có chắc chắn muốn đăng xuất không?',
                [
                    {
                        text: 'Hủy',
                        style: 'cancel'
                    },
                    {
                        text: 'Đăng xuất',
                        onPress: async () => {
                            try {
                                // Xóa token khỏi AsyncStorage
                                await AsyncStorage.removeItem('token');
                                await AsyncStorage.removeItem('refresh_token');
                                
                                // Cập nhật state global
                                dispatch({ type: 'LOGOUT' });
                                
                                Alert.alert('Đăng xuất thành công', 'Hẹn gặp lại bạn!');
                                
                                // Điều hướng về màn hình Login
                                // navigation.navigate('login');
                            } catch (error) {
                                console.error("Lỗi khi đăng xuất:", error);
                                Alert.alert('Lỗi', 'Không thể đăng xuất. Vui lòng thử lại.');
                            }
                        },
                        style: 'destructive'
                    }
                ]
            );
        } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
            Alert.alert('Lỗi', 'Không thể đăng xuất. Vui lòng thử lại.');
        }
    };

    const pickImage = async () => {
        try {
            // Xin quyền truy cập media
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Cần quyền truy cập', 'Bạn cần cấp quyền truy cập thư viện ảnh để sử dụng tính năng này.');
                return;
            }
            
            // Hiển thị tùy chọn
            Alert.alert(
                'Cập nhật ảnh đại diện',
                'Chọn nguồn ảnh:',
                [
                    {
                        text: 'Thư viện ảnh',
                        onPress: async () => {
                            let result = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                allowsMultipleSelection: false,
                                allowsEditing: true,
                                aspect: [1, 1],
                                quality: 0.7,
                            });
                            
                            if (!result.canceled) {
                                setAvatar(result.assets[0].uri);
                                setAvatarKey(Date.now()); // Cập nhật key để force re-render Avatar
                            }
                        }
                    },
                    {
                        text: 'Chụp ảnh mới',
                        onPress: async () => {
                            const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
                            
                            if (cameraPermission.granted) {
                                let result = await ImagePicker.launchCameraAsync({
                                    allowsEditing: true,
                                    aspect: [1, 1],
                                    quality: 0.7,
                                });
                                
                                if (!result.canceled) {
                                    setAvatar(result.assets[0].uri);
                                    setAvatarKey(Date.now());
                                }
                            } else {
                                Alert.alert('Cần quyền truy cập', 'Bạn cần cấp quyền truy cập camera để sử dụng tính năng này.');
                            }
                        }
                    },
                    {
                        text: 'Hủy',
                        style: 'cancel'
                    }
                ]
            );
        } catch (error) {
            console.error("Lỗi khi chọn ảnh:", error);
            Alert.alert('Lỗi', 'Không thể chọn ảnh. Vui lòng thử lại.');
        }
    };    const handleUpdate = async () => {
        setUpdating(true);
        try {
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                Alert.alert(
                    "Phiên đăng nhập hết hạn",
                    "Vui lòng đăng nhập lại để tiếp tục.",
                    [{ text: "Đăng nhập", onPress: () => navigation.navigate('login') }]
                );
                return;
            }
            
            let formData = new FormData();
            formData.append('phone', phone);
            
            // Chỉ thêm avatar nếu đã thay đổi
            if (avatar && avatar !== user.avatar) {
                const filename = avatar.split('/').pop();
                const match = /\.([\w]+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image`;
                formData.append('avatar', { uri: avatar, name: filename, type });
            }
            
            // Sử dụng authApis với token - không cần await vì authApis không phải async
            const authApi = authApis(token);
            
            const res = await authApi.patch(endpoints.updateUser, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            // Cập nhật thông tin người dùng trong context global
            dispatch({ type: 'LOGIN', payload: res.data });
            
            Alert.alert(
                'Cập nhật thành công', 
                'Thông tin tài khoản của bạn đã được cập nhật!',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            // Sau khi cập nhật thành công, làm mới dữ liệu
                            setUserData(res.data);
                        }
                    }
                ]
            );
        } catch (err) {
            console.error("Lỗi cập nhật:", err);
            
            if (err.response && err.response.status === 401) {
                Alert.alert(
                    "Phiên đăng nhập hết hạn",
                    "Vui lòng đăng nhập lại để tiếp tục.",
                    [{ text: "Đăng nhập", onPress: handleLogout }]
                );
            } else {
                Alert.alert(
                    'Lỗi cập nhật', 
                    `Không thể cập nhật thông tin: ${err.response?.data?.detail || err.message}`
                );
            }
        } finally {
            setUpdating(false);
        }
    };// Sửa lại phần render để hiển thị dữ liệu từ userData hoặc user
    if (!user && !userData) {
        return (
            <View style={styles.notLoggedInContainer}>
                <Animatable.View 
                    animation="fadeIn" 
                    duration={800} 
                    style={styles.notLoggedInCard}
                >
                    <Animatable.View animation="pulse" iterationCount="infinite" duration={2000}>
                        <MaterialCommunityIcons name="account-lock" size={90} color={COLORS.primary} />
                    </Animatable.View>
                    <Text style={styles.notLoggedInTitle}>Bạn chưa đăng nhập</Text>
                    <Text style={styles.notLoggedInSubtitle}>
                        Vui lòng đăng nhập để xem và quản lý thông tin tài khoản của bạn
                    </Text>
                    <Animatable.View animation="fadeInUp" delay={300}>
                        <Button 
                            mode="contained" 
                            onPress={() => navigation.navigate('login')} 
                            style={styles.loginButton}
                            contentStyle={{ paddingVertical: 8 }}
                            labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                            icon={({size, color}) => (
                                <MaterialCommunityIcons name="login" size={size} color={color} />
                            )}
                        >
                            Đăng nhập ngay
                        </Button>
                    </Animatable.View>
                </Animatable.View>
            </View>
        );
    }    // Ưu tiên dữ liệu từ userData (API), nếu không có thì dùng từ context
    const displayData = userData || user || {};
    
    // Background image với gradient ấn tượng
    const backgroundImage = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxleHBsb3JlLWZlZWR8MXx8fGVufDB8fHx8&w=1000&q=80";

    return (
        <ScrollView style={styles.container}>            <View style={styles.headerContainer}>
                <ImageBackground 
                    source={{ uri: backgroundImage }}
                    style={styles.headerBackground}
                    resizeMode="cover"
                >
                    <LinearGradient
                        colors={['rgba(94, 53, 177, 0.4)', 'rgba(94, 53, 177, 0.8)']}
                        style={styles.gradientOverlay}
                    />
                    
                    {/* Nút thông báo */}
                    <TouchableOpacity 
                        style={styles.notificationButton}
                        onPress={() => navigation.navigate('Notifications')}
                    >
                        <MaterialCommunityIcons name="bell" size={24} color="#fff" />
                        {unreadNotificationsCount > 0 && (
                            <View style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>
                                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    
                    <View style={styles.headerContentWrapper}>
                        <Animatable.View 
                            style={styles.headerContent}
                            animation="fadeIn"
                            duration={1000}
                        >
                            <View style={styles.avatarContainer}>
                                {avatar ? (
                                    <Animatable.Image
                                        animation="zoomIn"
                                        duration={500}
                                        key={avatarKey}
                                        source={{ uri: getAvatarUri(avatar) }}
                                        style={styles.avatar}
                                    />
                                ) : (
                                    <Animatable.View 
                                        animation="zoomIn"
                                        duration={500}
                                        style={styles.profileImagePlaceholder}
                                    >
                                        <MaterialCommunityIcons name="account" size={70} color={COLORS.primary} />
                                    </Animatable.View>
                                )}
                                <TouchableOpacity 
                                    style={styles.photoButton} 
                                    onPress={pickImage}
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons name="camera" size={20} color="white" />
                                </TouchableOpacity>
                            </View>
                            
                            <Animatable.Text 
                                animation="fadeInUp"
                                duration={700}
                                delay={300}
                                style={styles.title}
                            >
                                {displayData.first_name || ''} {displayData.last_name || ''}
                            </Animatable.Text>
                            
                            <Animatable.Text 
                                animation="fadeInUp"
                                duration={700}
                                delay={400}
                                style={styles.subtitle}
                            >
                                @{displayData.username}
                            </Animatable.Text>
                            
                            <Animatable.View
                                animation="fadeInUp"
                                duration={700}
                                delay={500}
                                style={styles.userRoleChip}
                            >
                                <FontAwesome5 
                                    name={displayData.role === 'organizer' ? 'user-tie' : 'user'} 
                                    size={14} 
                                    color="#fff" 
                                />
                                <Text style={styles.userRoleText}>
                                    {displayData.role === 'attendee' ? 'Người tham dự' : dispatch.role === 'organizer' ? 'Nhà tổ chức sự kiện': 'Quản trị viên'}
                                </Text>
                            </Animatable.View>
                        </Animatable.View>
                    </View>
                </ImageBackground>
            </View>

            {/* Stats Section */}
            <Animatable.View
                animation="fadeInUp"
                duration={700}
                delay={600}
                style={styles.statsContainer}
            >
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>12</Text>
                    <Text style={styles.statLabel}>Sự kiện</Text>
                </View>
                
                <View style={styles.statDivider} />
                
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>4</Text>
                    <Text style={styles.statLabel}>Vé</Text>
                </View>
                
                <View style={styles.statDivider} />
                
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>7</Text>
                    <Text style={styles.statLabel}>Đánh giá</Text>
                </View>
            </Animatable.View>

            <View style={styles.contentContainer}>                <Animatable.View 
                    animation="fadeInUp"
                    duration={600}
                    delay={700}
                    style={styles.card}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="account-details" size={24} style={styles.sectionIcon} />
                            <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
                        </View>
                    </View>
                    
                    <View style={styles.cardContent}>
                        <View style={styles.infoItem}>
                            <Ionicons name="mail" size={22} style={styles.infoIcon} />
                            <Text style={styles.infoLabel}>Email:</Text>
                            <Text style={styles.infoValue}>{displayData.email || 'Chưa cập nhật'}</Text>
                        </View>
                        
                        <View style={styles.infoItem}>
                            <Ionicons name="calendar" size={22} style={styles.infoIcon} />
                            <Text style={styles.infoLabel}>Tham gia:</Text>
                            <Text style={styles.infoValue}>
                                {displayData.date_joined 
                                    ? new Date(displayData.date_joined).toLocaleDateString('vi-VN') 
                                    : 'Không có dữ liệu'}
                            </Text>
                        </View>
                    </View>
                </Animatable.View>
            
                <Animatable.View 
                    animation="fadeInUp"
                    duration={600}
                    delay={800}
                    style={styles.card}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="phone-settings" size={24} style={styles.sectionIcon} />
                            <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>
                        </View>
                    </View>
                    
                    <View style={styles.cardContent}>
                        <View style={styles.inputContainer}>
                            <TextInput
                                mode="outlined"
                                label="Số điện thoại"
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="Nhập số điện thoại của bạn"
                                keyboardType="phone-pad"
                                style={styles.input}
                                outlineColor={COLORS.border}
                                activeOutlineColor={COLORS.primary}
                                textColor={COLORS.text}
                                left={<TextInput.Icon icon="phone" color={COLORS.primary} />}
                            />
                        </View>
                    </View>
                </Animatable.View>
                  <Animatable.View 
                    animation="fadeInUp"
                    duration={600}
                    delay={900}
                    style={styles.card}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="cog" size={24} style={styles.sectionIcon} />
                            <Text style={styles.sectionTitle}>Tùy chọn tài khoản</Text>
                        </View>
                    </View>
                    
                    <View style={styles.cardContent}>
                        <View style={styles.buttonContainer}>
                            <Button 
                                mode="contained" 
                                onPress={handleUpdate}
                                loading={updating}
                                disabled={updating}
                                icon={({size, color}) => (
                                    <MaterialCommunityIcons name="content-save" size={size} color={color} />
                                )}
                                style={styles.updateButton}
                                contentStyle={{ paddingVertical: 8 }}
                                labelStyle={{ fontSize: 16, fontWeight: 'bold' }}
                            >
                                Lưu thông tin
                            </Button>
                            
                            <Button 
                                mode="outlined" 
                                onPress={handleLogout}
                                icon={({size, color}) => (
                                    <MaterialCommunityIcons name="logout" size={size} color={color} />
                                )}
                                style={styles.logoutButton}
                                contentStyle={{ paddingVertical: 8 }}
                                labelStyle={styles.logoutText}
                            >
                                Đăng xuất
                            </Button>
                        </View>
                    </View>                </Animatable.View>
                
                {/* <Animatable.View 
                    animation="fadeInUp"
                    duration={600}
                    delay={1000}
                    style={styles.card}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.sectionHeader}>
                            <MaterialCommunityIcons name="bell-outline" size={24} style={styles.sectionIcon} />
                            <Text style={styles.sectionTitle}>Thông báo</Text>
                        </View>
                    </View>
                    
                    <View style={styles.cardContent}>
                        <TouchableOpacity 
                            style={styles.settingItem}
                            onPress={() => navigation.navigate('Notifications')}
                        >
                            <View style={styles.settingIconContainer}>
                                <MaterialCommunityIcons name="bell-ring-outline" size={24} color={COLORS.primary} />
                            </View>
                            <View style={styles.settingContent}>
                                <Text style={styles.settingTitle}>Quản lý thông báo</Text>
                                <Text style={styles.settingDescription}>Xem các thông báo về sự kiện và cập nhật</Text>
                            </View>
                            <MaterialIcons name="keyboard-arrow-right" size={24} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </Animatable.View> */}
                
                {/* Footer */}
                <Animatable.View 
                    animation="fadeIn"
                    duration={600}
                    delay={1000}
                    style={styles.footerContainer}
                >
                    <Text style={styles.versionText}>EventGo v1.0.0</Text>
                </Animatable.View>
            </View>
        </ScrollView>
    );
}
