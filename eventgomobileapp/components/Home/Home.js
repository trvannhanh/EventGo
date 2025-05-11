import React, { useState, useContext, useEffect } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, ScrollView, Image, SafeAreaView, Dimensions } from 'react-native';
import MyStyles from '../styles/MyStyles';
import { TextInput as PaperTextInput, Button as PaperButton, Paragraph, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MyUserContext } from '../../configs/MyContexts';
import { useNavigation } from '@react-navigation/native';
import Apis, { endpoints } from '../../configs/Apis';

const { width } = Dimensions.get('window');

const Home = ({ navigation }) => {
    const [eventCates, setEventCates] = useState([]);
    const [events, setEvents] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [cateId, setCateId] = useState(null);
    const nav = useNavigation();
    const [location, setLocation] = useState('New York, USA');
    const user = useContext(MyUserContext);

    // Ánh xạ tên danh mục sang icon
    const categoryIcons = {
        'Lễ Hội': 'music',
        "Thể Thao": 'soccer',
        "Họp Báo": 'briefcase',
        // Thêm các danh mục khác nếu cần
    };

    const loadEventCates = async () => {
        let res = await Apis.get(endpoints['eventCategories']);
        setEventCates(res.data);
    };

    const loadEvents = async () => {
        if (page > 0) {
            let url = `${endpoints['events']}?page=${page}&status=upcoming`;

            if (search) {
                url = `${url}&q=${search}`
            }

            if (cateId) {
                url = `${url}&cateId=${cateId}`;
            }



            try {
                setLoading(true);
                let res = await Apis.get(url);
                console.log('API events response:', res.data);
                setEvents([...events, ...res.data.results]);

                if (res.data.next === null)
                    setPage(0);
            } catch (ex) {
                console.error('Error loading events:', ex);
                Alert.alert('Lỗi', 'Không thể tải sự kiện');
            } finally {
                setLoading(false);
            }
        }
    }
    

    useEffect(() =>{
        loadEventCates();
    }, []);

    useEffect(() => {
        let timer = setTimeout(() => {
            loadEvents();
        }, 500);

        return () => clearTimeout(timer);

    }, [search, cateId, page]);

     useEffect(() => {
        setPage(1);
        setEvents([]);
    }, [search, cateId]);
    
   const loadMore = () => {
        if (!loading && page > 0) {
            setPage(page + 1);
        }
    };

     const handleCategoryPress = (id) => {
        setCateId(cateId === id ? null : id); // Toggle danh mục
    };


    const isOrganizer = user && (user.role === 'organizer' || user.role === 'admin');

    const handleCreateEvent = () => {
        if (user && (user.role === 'organizer' || user.role === 'admin')) {
            navigation.navigate('CreateEvent');
        } else {
            Alert.alert(
                "Thông báo",
                "Chỉ nhà tổ chức và quản trị viên mới có quyền tạo sự kiện.",
                [{ text: "OK" }]
            );
        }
    };


    return (
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.headerContent}>
                            <MaterialCommunityIcons name="menu" size={24} color="#FFF" />
                            <View style={styles.location}>
                                <MaterialCommunityIcons name="map-marker" size={16} color="#FFF" />
                                <Text style={styles.locationText}>Current Location {'>'}</Text>
                                <Text style={styles.locationValue}>{location}</Text>
                            </View>
                            <MaterialCommunityIcons name="bell" size={24} color="#FFF" />
                        </View>
                    </SafeAreaView>
                </View>
                <View style={styles.searchContainer}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#666" style={styles.searchIcon} />
                    <PaperTextInput
                        mode="outlined"
                        label="Search..."
                        value={search}
                        onChangeText={setSearch}
                        style={styles.searchInput}
                        outlineColor="#A49393"
                        activeOutlineColor="#4A90E2"
                        textColor="#333"
                    />
                    <TouchableOpacity style={styles.filters}>
                        <MaterialCommunityIcons name="filter" size={20} color="#FFF" />
                        <Text style={styles.filtersText}>Filters</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.categoryContainer}>
                    <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.eventScroll}>

                    
                    {eventCates.map(e => (
                        <TouchableOpacity
                            key={e.id}
                            style={[
                                styles.categoryButton,
                                { backgroundColor: cateId === e.id ? '#FF6B6B' : '#6D4AFF' }
                            ]}
                            onPress={() => handleCategoryPress(e.id)}
                        >
                            <MaterialCommunityIcons
                                name={categoryIcons[e.name] || 'calendar'}
                                size={20}
                                color="#FFF"
                            />
                            <Text style={styles.categoryText}>{e.name}</Text>
                        </TouchableOpacity>
                    ))}

                    </ScrollView>
                </View>
                <ScrollView style={styles.content} onScrollEndDrag={loadMore}>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Upcoming Events</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('EventList')}>
                                <Text style={styles.seeAll}>See All {'>'}</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.eventScroll}>
                            {events.length === 0 && !loading && ( 
                                <Text style={styles.noEvents}>Không có sự kiện nào</Text>
                            )}
                            {events.map((event) => (
                                <TouchableOpacity
                                    key={event.id}
                                    style={styles.eventCard}
                                    onPress={() => navigation.navigate('EventDetail', { 'eventId': event.id })}
                                >
                                    <Image
                                        source={{ uri: event.image }}
                                        style={styles.eventImage}
                                    />
                                    <View style={styles.eventInfo}>
                                        <Text style={styles.eventDate}>
                                            {new Date(event.date).toLocaleDateString()}
                                        </Text>
                                        <Text style={styles.eventTitle}>{event.name}</Text>
                                        <View style={styles.eventDetails}>
                                            <MaterialCommunityIcons name="map-marker" size={12} color="#666" />
                                            <Text style={styles.eventLocation}>{event.location}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Nearby You</Text>
                            <TouchableOpacity>
                                <Text style={styles.seeAll}>See All {'>'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
                {isOrganizer && (
                    <FAB
                        style={styles.fab}
                        icon="plus"
                        onPress={handleCreateEvent}
                        color="#FFF"
                        theme={{ colors: { accent: '#A49393' } }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        backgroundColor: '#4A90E2',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
    },
    location: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationText: {
        color: '#FFF',
        marginRight: 5,
    },
    locationValue: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#FFF',
        marginTop: 70,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    filters: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#9B59B6',
        padding: 5,
        borderRadius: 15,
    },
    filtersText: {
        color: '#FFF',
        marginLeft: 5,
    },
    categoryContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 10,
        backgroundColor: '#FFF',
    },
    categoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        elevation: 2,
        margin: 5
    },
    categoryText: {
        color: '#FFF',
        marginLeft: 5,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    section: {
        padding: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    seeAll: {
        color: '#9B59B6',
    },
    eventScroll: {
        paddingVertical: 5,
    },
    eventCard: {
        width: width * 0.75,
        backgroundColor: '#FFF',
        borderRadius: 15,
        marginRight: 10,
        elevation: 4,
        overflow: 'hidden',
    },
    eventImage: {
        width: '100%',
        height: 150,
    },
    eventInfo: {
        padding: 10,
    },
    eventDate: {
        color: '#FF6B6B',
        fontWeight: 'bold',
        fontSize: 14,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginVertical: 5,
    },
    eventDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 5,
    },
    eventLocation: {
        color: '#666',
        marginLeft: 5,
    },
    eventGoing: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
    },
    avatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        marginRight: 5,
    },
    goingText: {
        color: '#4A90E2',
    },
    inviteCard: {
        backgroundColor: '#E8F5E9',
        borderRadius: 15,
        padding: 15,
        marginBottom: 10,
        alignItems: 'center',
        elevation: 2,
    },
    inviteTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    inviteSubtitle: {
        color: '#666',
        marginVertical: 5,
    },
    inviteButton: {
        backgroundColor: '#4CAF50',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 80,
        backgroundColor: '#A49393',
    },
});

export default Home;