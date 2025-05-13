import React, { useState, useContext, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, ScrollView, Image, SafeAreaView, Dimensions, RefreshControl } from 'react-native';
import { TextInput, Button, ActivityIndicator, Chip, Divider, Surface, Searchbar, FAB, Portal, Dialog, Badge, Card, Title, Paragraph } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MyUserContext } from '../../configs/MyContexts';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Apis, { endpoints } from '../../configs/Apis';
import { COLORS } from '../../components/styles/MyStyles';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const Home = ({ navigation }) => {
    
    const [eventCates, setEventCates] = useState([]);
    const [events, setEvents] = useState([]);
    const [trendingEvents, setTrendingEvents] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [cateId, setCateId] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [filterVisible, setFilterVisible] = useState(false);
    const nav = useNavigation();
    const [location, setLocation] = useState('TP. Hồ Chí Minh');
    const user = useContext(MyUserContext);

    // Ánh xạ tên danh mục sang icon
    const categoryIcons = {
        'Lễ Hội': 'music-note',
        "Thể Thao": 'soccer',
        "Họp Báo": 'briefcase',
        "Hội Thảo": 'notebook',
        "Giải Trí": 'controller',
        "Giáo Dục": 'school',
        "Công Nghệ": 'laptop',
        "Kinh Doanh": 'chart-line',
        // Mặc định
        "default": 'calendar-month'
    };

    const loadEventCates = async () => {
        try {
            let res = await Apis.get(endpoints['eventCategories']);
            setEventCates(res.data);
        } catch (error) {
            console.error('Failed to load event categories:', error);
            setLoadError('Không thể tải danh mục sự kiện');
        }
    };

    const loadEvents = async (pageToLoad = 1, shouldRefresh = false) => {
        if (!hasMore && pageToLoad > 1 && !shouldRefresh) return;
        
        try {
            setLoading(true);
            setLoadError(null);
            
            let url = `${endpoints['events']}?page=${pageToLoad}&status=upcoming`;

            if (search) {
                url = `${url}&q=${search}`
            }

            if (cateId) {
                url = `${url}&cateId=${cateId}`;
            }

            const res = await Apis.get(url);
            
            if (shouldRefresh || pageToLoad === 1) {
                setEvents(res.data.results || []);
            } else {
                setEvents(prev => [...prev, ...(res.data.results || [])]);
            }

            setHasMore(res.data.next !== null);
            setPage(pageToLoad);
            
        } catch (error) {
            console.error('Error loading events:', error);
            setLoadError('Không thể tải sự kiện');
        } finally {
            setLoading(false);
            setInitialLoading(false);
            setRefreshing(false);
        }
    };

    // Load sự kiện trending
    const loadTrendingEvents = async () => {
        try {
            const res = await Apis.get(endpoints['trendingEvents']);
            setTrendingEvents(res.data || []);
        } catch (error) {
            console.error('Error loading trending events:', error);
            // Không hiển thị lỗi cho trending, chỉ log
        }
    };
    
    // Refresh tất cả dữ liệu
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setPage(1);
        setHasMore(true);
        Promise.all([
            loadEvents(1, true),
            loadTrendingEvents(),
            loadEventCates()
        ]).finally(() => {
            setRefreshing(false);
        });
    }, [search, cateId]);

    // Load dữ liệu ban đầu khi component mount
    useEffect(() => {
        setInitialLoading(true);
        Promise.all([
            loadEventCates(),
            loadTrendingEvents()
        ]).finally(() => {
            loadEvents(1, true);
        });
    }, []);

    // Load sự kiện khi search hoặc category thay đổi
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            loadEvents(1, true);
        }, 500);

        return () => clearTimeout(timer);
    }, [search, cateId]);

    // Đảm bảo refresh dữ liệu khi quay lại tab này
    useFocusEffect(
        useCallback(() => {
            // Chỉ refresh khi đã có dữ liệu trước đó
            if (!initialLoading) {
                onRefresh();
            }
            return () => {};
        }, [initialLoading, onRefresh])
    );
    
    const loadMore = () => {
        if (!loading && hasMore) {
            loadEvents(page + 1);
        }
    };    const handleCategoryPress = (id) => {
        setCateId(cateId === id ? null : id); // Toggle danh mục
    };

    // Kiểm tra xem user có phải là đối tượng hợp lệ hay không
    const isValidUser = user && typeof user === 'object' && (user.role !== undefined || user.username !== undefined || user.id !== undefined);
    const isOrganizer = isValidUser && (user.role === 'organizer' || user.role === 'admin');
    console.log("User context:", user);
    console.log("Is valid user:", isValidUser);
    
    const handleCreateEvent = () => {
        if (isOrganizer) {
            navigation.navigate('CreateEvent');
        } else {
            Alert.alert(
                "Thông báo",
                "Chỉ nhà tổ chức và quản trị viên mới có quyền tạo sự kiện.",
                [{ text: "OK" }]
            );
        }
    };

    // Hiển thị dialog filter
    const showFilterDialog = () => setFilterVisible(true);
    const hideFilterDialog = () => setFilterVisible(false);

    // Render Category Chip
    const renderCategoryChip = useCallback((category) => (
        <Chip
            key={category.id}
            selected={cateId === category.id}
            onPress={() => handleCategoryPress(category.id)}
            style={[
                styles.categoryChip,
                cateId === category.id && styles.categoryChipSelected
            ]}
            textStyle={[
                styles.categoryChipText,
                cateId === category.id && styles.categoryChipTextSelected
            ]}
            icon={props => (
                <MaterialCommunityIcons
                    name={categoryIcons[category.name] || categoryIcons.default}
                    {...props}
                    size={16}
                    color={cateId === category.id ? COLORS.onPrimary : COLORS.primary}
                />
            )}
        >
            {category.name}
        </Chip>
    ), [cateId, categoryIcons]);

    // Render Trending Event Card
    const renderTrendingEventCard = useCallback((event) => {
        if (!event || !event.id) return null;
        
        const imageUri = event.image || 'https://via.placeholder.com/300x200?text=No+Image';
        const eventDate = event.date ? new Date(event.date) : new Date();
        const eventName = event.name || 'Sự kiện không tên';
        const eventLocation = event.location || 'Chưa cập nhật địa điểm';
        const eventCategory = event.category_name || 'Danh mục';
        
        return (
            <Card key={`trending-${event.id}`} style={styles.trendingCard} mode="elevated">
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('EventDetail', { 'eventId': event.id })}
                >
                    <Card.Cover 
                        source={{ uri: imageUri }} 
                        style={styles.trendingImage}
                    />
                    <Badge 
                        style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            backgroundColor: COLORS.secondary,
                        }}
                    >
                        Hot
                    </Badge>
                    <Card.Content style={styles.trendingContent}>
                        <View style={styles.trendingTagContainer}>
                            <Text style={styles.trendingTag}>{eventCategory}</Text>
                        </View>
                        <Text style={styles.trendingTitle} numberOfLines={2}>
                            {eventName}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.textSecondary} />
                            <Text style={styles.trendingLocation} numberOfLines={1}>
                                {eventLocation}
                            </Text>
                        </View>
                        <Text style={styles.trendingDate}>
                            {eventDate.toLocaleDateString('vi-VN', { 
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric' 
                            })}
                        </Text>
                    </Card.Content>
                </TouchableOpacity>
            </Card>
        );
    }, [navigation]);

    // Render Event Card
    const renderEventCard = useCallback((event) => {
        if (!event || !event.id) return null;
        
        const imageUri = event.image || 'https://via.placeholder.com/300x200?text=No+Image';
        const eventDate = event.date ? new Date(event.date) : new Date();
        const eventName = event.name || 'Sự kiện không tên';
        const eventLocation = event.location || 'Chưa cập nhật địa điểm';
        const eventCategory = event.category_name || 'Danh mục';
        
        return (
            <Card 
                key={`event-${event.id}`} 
                style={styles.eventCard}
                mode="elevated"
            >
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('EventDetail', { 'eventId': event.id })}
                >
                    <Card.Cover 
                        source={{ uri: imageUri }} 
                        style={styles.eventImage}
                    />
                    <Card.Content style={styles.eventDetails}>
                        <View style={styles.eventTagRow}>
                            <Text style={styles.eventTag}>{eventCategory}</Text>
                        </View>
                        <Text style={styles.eventTitle} numberOfLines={2}>
                            {eventName}
                        </Text>
                        <View style={styles.eventMetaRow}>
                            <MaterialCommunityIcons 
                                name="calendar" 
                                size={14} 
                                style={styles.eventMetaIcon} 
                            />
                            <Text style={styles.eventMetaText}>
                                {eventDate.toLocaleDateString('vi-VN', { 
                                    weekday: 'short',
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric' 
                                })}
                            </Text>
                        </View>
                        <View style={styles.eventMetaRow}>
                            <MaterialCommunityIcons 
                                name="map-marker" 
                                size={14} 
                                style={styles.eventMetaIcon} 
                            />
                            <Text style={styles.eventMetaText} numberOfLines={1}>
                                {eventLocation}
                            </Text>
                        </View>
                    </Card.Content>
                </TouchableOpacity>
            </Card>
        );
    }, [navigation]);

    // Render Empty State
    const renderEmptyState = useCallback((title, icon = "calendar-remove") => (
        <View style={styles.emptyStateContainer}>
            <MaterialCommunityIcons name={icon} size={60} color={COLORS.textSecondary} />
            <Text style={styles.emptyStateText}>{title}</Text>
        </View>
    ), []);

    // Render Loading State
    const renderLoading = useCallback(() => {
        if (loading && !refreshing) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={{ color: COLORS.textSecondary, marginTop: 8 }}>
                        Đang tải...
                    </Text>
                </View>
            );
        }
        return null;
    }, [loading, refreshing]);

    // Render Main Content
    const renderContent = () => {
        if (initialLoading) {
            return (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={{ color: COLORS.textSecondary, marginTop: 16 }}>
                        Đang tải sự kiện...
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView
                style={{ flex: 1, backgroundColor: COLORS.background }}
                contentContainerStyle={{ paddingBottom: 80 }}
                onScroll={({ nativeEvent }) => {
                    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                    const paddingToBottom = 20;
                    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
                        loadMore();
                    }
                }}
                scrollEventThrottle={400}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            >
                {loadError && (
                    <View style={styles.errorContainer}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={24} color={COLORS.error} />
                        <Text style={styles.errorText}>{loadError}</Text>
                        <Button 
                            mode="contained" 
                            onPress={onRefresh}
                            style={styles.retryButton}
                        >
                            Thử lại
                        </Button>
                    </View>
                )}

                {/* Trending Events Section */}
                <View style={styles.trendingContainer}>
                    <View style={styles.categoryHeaderContainer}>
                        <Text style={styles.sectionHeader}>Sự kiện nổi bật</Text>
                        <TouchableOpacity onPress={() => {}}>
                            <Text style={styles.categorySeeAll}>Xem tất cả</Text>
                        </TouchableOpacity>
                    </View>
                    
                    {trendingEvents.length === 0 ? (
                        renderEmptyState("Không có sự kiện nổi bật", "star-off")
                    ) : (
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.trendingScroll}
                        >
                            {trendingEvents.map(event => renderTrendingEventCard(event))}
                        </ScrollView>
                    )}
                </View>

                <Divider style={styles.divider} />

                {/* All Events */}
                <View style={styles.eventsContainer}>
                    <View style={styles.categoryHeaderContainer}>
                        <Text style={styles.sectionHeader}>Sự kiện sắp diễn ra</Text>
                        <TouchableOpacity onPress={() => {}}>
                            <Text style={styles.categorySeeAll}>Xem tất cả</Text>
                        </TouchableOpacity>
                    </View>
                    
                    {events.length === 0 ? (
                        renderEmptyState("Không có sự kiện nào được tìm thấy", "calendar-blank")
                    ) : (
                        events.map(event => renderEventCard(event))
                    )}
                    
                    {renderLoading()}
                </View>
            </ScrollView>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <StatusBar style="auto" />
            
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerRow}>                        <View>
                            <Text style={styles.greeting}>
                                {isValidUser ? `Xin chào, ${user.firstName || 'Bạn'}!` : 'Khám phá sự kiện'}
                            </Text>
                            <TouchableOpacity style={styles.locationContainer}>
                                <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.textSecondary} />
                                <Text style={styles.locationText}>{location}</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <TouchableOpacity 
                            style={styles.userAvatar}
                            onPress={() => isValidUser ? navigation.navigate('Profile') : navigation.navigate('Login')}
                        >
                            {isValidUser && user.avatar ? (
                                <Image 
                                    source={{ uri: user.avatar }} 
                                    style={{ width: 40, height: 40, borderRadius: 20 }} 
                                />
                            ) : (
                                <Text style={styles.userAvatarText}>
                                    {isValidUser ? user.firstName?.charAt(0).toUpperCase() : '?'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                    
                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <Searchbar
                            placeholder="Tìm kiếm sự kiện..."
                            onChangeText={setSearch}
                            value={search}
                            style={styles.searchInput}
                            icon="magnify"
                            clearIcon="close-circle"
                        />
                    </View>
                </View>
                
                {/* Categories */}
                <View style={styles.categoryContainer}>
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryScroll}
                    >
                        {eventCates.map(category => renderCategoryChip(category))}
                    </ScrollView>
                </View>
                
                {/* Main Content */}
                {renderContent()}
                  {/* Create Event FAB */}
                {isOrganizer && (
                    <FAB
                        style={styles.fab}
                        icon="plus"
                        color={COLORS.onPrimary}
                        onPress={handleCreateEvent}
                    />
                )}
                
                {/* Filter Dialog */}
                <Portal>
                    <Dialog visible={filterVisible} onDismiss={hideFilterDialog} style={styles.filterDialog}>
                        <Dialog.Title style={styles.dialogTitle}>Bộ lọc sự kiện</Dialog.Title>
                        <Dialog.Content>
                            <Text style={styles.filterLabel}>Tính năng đang được phát triển</Text>
                        </Dialog.Content>
                        <Dialog.Actions>
                            <Button onPress={hideFilterDialog}>Đóng</Button>
                            <Button mode="contained" onPress={hideFilterDialog}>Áp dụng</Button>
                        </Dialog.Actions>
                    </Dialog>
                </Portal>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: 0,
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        backgroundColor: COLORS.background,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    greeting: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    locationText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
    userAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.lightPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userAvatarText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.onPrimary,
    },
    searchContainer: {
        marginTop: 8,
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    searchInput: {
        height: 46,
        elevation: 2,
        backgroundColor: COLORS.surface,
        borderRadius: 12,
    },
    categoryContainer: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    categoryHeaderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    categoryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    categorySeeAll: {
        fontSize: 14,
        color: COLORS.primary,
    },
    categoryScroll: {
        paddingBottom: 8,
    },
    categoryChip: {
        marginRight: 8,
        backgroundColor: COLORS.surface,
        borderRadius: 20,
    },
    categoryChipSelected: {
        backgroundColor: COLORS.primary,
    },
    categoryChipText: {
        color: COLORS.textSecondary,
    },
    categoryChipTextSelected: {
        color: COLORS.onPrimary,
    },
    trendingContainer: {
        paddingLeft: 16,
        marginTop: 16,
        marginBottom: 24,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        paddingRight: 16,
        color: COLORS.text,
    },
    trendingScroll: {
        paddingBottom: 8,
    },
    trendingCard: {
        width: width * 0.75,
        marginRight: 16,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 3,
    },
    trendingImage: {
        width: '100%',
        height: 160,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    trendingContent: {
        padding: 12,
    },
    trendingTagContainer: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    trendingTag: {
        fontSize: 12,
        color: COLORS.primary,
        backgroundColor: COLORS.lightPrimary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    trendingTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
        color: COLORS.text,
    },
    trendingLocation: {
        fontSize: 12,
        color: COLORS.textSecondary,
        flexDirection: 'row',
        alignItems: 'center',
    },
    trendingDate: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    eventsContainer: {
        paddingHorizontal: 16,
        paddingBottom: 80,
    },
    eventCard: {
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 2,
    },
    eventCardContent: {
        padding: 0,
    },
    eventImage: {
        width: '100%',
        height: 180,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    eventImagePlaceholder: {
        width: '100%',
        height: 180,
        backgroundColor: COLORS.divider,
        justifyContent: 'center',
        alignItems: 'center',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    eventDetails: {
        padding: 12,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
        color: COLORS.text,
    },
    eventMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    eventMetaIcon: {
        marginRight: 4,
        color: COLORS.textSecondary,
    },
    eventMetaText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        flex: 1,
    },
    eventTagRow: {
        flexDirection: 'row',
        marginTop: 8,
    },
    eventTag: {
        fontSize: 12,
        color: COLORS.primary,
        backgroundColor: COLORS.lightPrimary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginRight: 8,
        borderRadius: 12,
    },
    loadingContainer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    errorContainer: {
        padding: 20,
        alignItems: 'center',
    },
    errorText: {
        color: COLORS.error,
        textAlign: 'center',
        marginBottom: 16,
    },
    retryButton: {
        marginTop: 8,
        backgroundColor: COLORS.primary,
    },
    divider: {
        backgroundColor: COLORS.divider,
        marginHorizontal: 16,
        marginVertical: 8,
    },
    filterDialog: {
        backgroundColor: COLORS.background,
        borderRadius: 20,
    },
    dialogTitle: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    filterLabel: {
        marginBottom: 8,
        color: COLORS.textSecondary,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: COLORS.primary,
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 40,
    },
    emptyStateImage: {
        width: 100, 
        height: 100,
        marginBottom: 16,
        tintColor: COLORS.textSecondary,
    },
    emptyStateText: {
        fontSize: 16,
        textAlign: 'center',
        color: COLORS.textSecondary,
        marginBottom: 16,
    },
});

export default Home;
