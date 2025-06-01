// eventgomobileapp/components/Dashboard/ComparativeAnalytics.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Card, Title, Chip, Button, Menu, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApis, endpoints } from '../../configs/Apis';
import { format, subMonths } from 'date-fns';

const screenWidth = Dimensions.get('window').width;

const ComparativeAnalytics = ({ navigation, route }) => {
    const { events } = route.params || { events: [] };
    
    const [selectedEvents, setSelectedEvents] = useState([]);
    const [analyticsData, setAnalyticsData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedMetric, setSelectedMetric] = useState('revenue');
    const [metricMenuVisible, setMetricMenuVisible] = useState(false);
    
    useEffect(() => {
        if (events && events.length > 0) {
            // Pre-select the first 2 events if none selected
            if (selectedEvents.length === 0 && events.length >= 2) {
                setSelectedEvents([events[0], events[1]]);
            }
        }
    }, [events]);
    
    useEffect(() => {
        if (selectedEvents.length > 0) {
            loadEventAnalytics();
        }
    }, [selectedEvents]);
      const loadEventAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const token = await AsyncStorage.getItem('token');
            if (!token) {
                setError("Không tìm thấy token xác thực. Vui lòng đăng nhập lại.");
                return;
            }
            
            const api = authApis(token);
            
            // Process each event individually to better handle errors
            const analyticsResults = [];
            for (const event of selectedEvents) {
                try {
                    console.log(`Fetching analytics for event ${event.event_id}: ${event.event_name || 'Unknown'}`);
                    const response = await api.get(endpoints.eventAnalytics(event.event_id));
                    analyticsResults.push(response.data);
                } catch (eventError) {
                    console.error(`Error loading analytics for event ${event.event_id}:`, eventError);
                    // Create a placeholder with basic info to prevent complete failure
                    analyticsResults.push({
                        event_id: event.event_id,
                        event_name: event.event_name || 'Unknown Event',
                        error: true,
                        total_revenue: 0,
                        tickets_sold: 0,
                        average_rating: 0,
                        event_views: 0,
                        conversion_rate: 0
                    });
                }
            }
            
            if (analyticsResults.length > 0) {
                setAnalyticsData(analyticsResults);
            } else {
                setError("Không thể tải dữ liệu thống kê cho bất kỳ sự kiện nào.");
            }
        } catch (error) {
            console.error("Error loading comparative analytics:", error);
            setError("Lỗi khi tải dữ liệu so sánh. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };
    
    const toggleEventSelection = (event) => {
        if (selectedEvents.some(e => e.event_id === event.event_id)) {
            // Remove from selection
            setSelectedEvents(selectedEvents.filter(e => e.event_id !== event.event_id));
        } else {
            // Add to selection (max 3)
            if (selectedEvents.length < 3) {
                setSelectedEvents([...selectedEvents, event]);
            }
        }
    };
    
    const getMetricLabel = () => {
        switch (selectedMetric) {
            case 'revenue': return 'Doanh thu';
            case 'tickets': return 'Số vé bán ra';
            case 'views': return 'Lượt xem';
            case 'rating': return 'Đánh giá';
            case 'conversion': return 'Tỷ lệ chuyển đổi';
            default: return 'Doanh thu';
        }
    };
    
    const getMetricValue = (data, metric) => {
        switch (metric) {
            case 'revenue': return data.total_revenue || 0;
            case 'tickets': return data.tickets_sold || 0;
            case 'views': return data.event_views || 0;
            case 'rating': return data.average_rating || 0;
            case 'conversion': return data.conversion_rate || 0;
            default: return data.total_revenue || 0;
        }
    };
    
    const getComparisonData = () => {
        if (!analyticsData || analyticsData.length === 0) return null;
        
        const chartData = {
            labels: analyticsData.map(data => data.event_name.substring(0, 10) + '...'),
            datasets: [{
                data: analyticsData.map(data => getMetricValue(data, selectedMetric)),
            }],
        };
        
        return chartData;
    };

    const getMetricSuffix = () => {
        switch (selectedMetric) {
            case 'revenue': return ' VND';
            case 'tickets': return ' vé';
            case 'views': return ' lượt';
            case 'rating': return '/5';
            case 'conversion': return '%';
            default: return '';
        }
    };
    
    const chartConfig = {
        backgroundColor: "#ffffff",
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        decimalPlaces: selectedMetric === 'rating' ? 1 : 0,
        color: (opacity = 1) => `rgba(81, 138, 78, ${opacity})`,
        style: {
            borderRadius: 16,
        },
        barPercentage: 0.8,
    };
    
    const renderComparisonMetrics = () => {
        if (!analyticsData || analyticsData.length < 2) return null;
        
        const metrics = [
            {
                key: 'revenue',
                label: 'Doanh thu',
                icon: 'currency-usd',
                color: '#28a745',
                format: (value) => `${(value / 1000).toFixed(1)}K`
            },
            {
                key: 'tickets',
                label: 'Vé bán ra',
                icon: 'ticket-confirmation',
                color: '#007bff',
                format: (value) => value
            },
            {
                key: 'views',
                label: 'Lượt xem',
                icon: 'eye',
                color: '#6f42c1',
                format: (value) => value
            },
            {
                key: 'rating',
                label: 'Đánh giá',
                icon: 'star',
                color: '#fd7e14',
                format: (value) => `${value}/5`
            },
            {
                key: 'conversion',
                label: 'Tỷ lệ chuyển đổi',
                icon: 'account-convert',
                color: '#17a2b8',
                format: (value) => `${value}%`
            },
        ];

        return (
            <Card style={styles.metricsCard}>
                <Card.Content>
                    <Title>So sánh chi tiết</Title>
                    <Divider style={styles.divider} />
                    
                    {metrics.map(metric => (
                        <View key={metric.key} style={styles.metricCompareRow}>
                            <View style={styles.metricLabelContainer}>
                                <MaterialCommunityIcons 
                                    name={metric.icon} 
                                    size={22} 
                                    color={metric.color} 
                                    style={styles.metricIcon}
                                />
                                <Text style={styles.metricLabel}>{metric.label}</Text>
                            </View>
                            
                            <View style={styles.metricValuesContainer}>
                                {analyticsData.map((data, index) => (
                                    <View key={index} style={[
                                        styles.metricValueBox,
                                        { borderColor: index === 0 ? '#007bff' : index === 1 ? '#28a745' : '#fd7e14' }
                                    ]}>
                                        <Text style={[
                                            styles.metricValue,
                                            { color: index === 0 ? '#007bff' : index === 1 ? '#28a745' : '#fd7e14' }
                                        ]}>
                                            {metric.format(getMetricValue(data, metric.key))}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </Card.Content>
            </Card>
        );
    };
    
    if (loading) {
        return <ActivityIndicator style={styles.loader} size="large" color="#007bff" />;
    }
    
    if (error) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }
    
    const comparisonData = getComparisonData();
    
    return (
        <ScrollView style={styles.container}>
            <View style={styles.headerContainer}>
                <Text style={styles.title}>So sánh sự kiện</Text>
                <Text style={styles.subtitle}>Chọn tối đa 3 sự kiện để so sánh</Text>
            </View>
            
            <View style={styles.eventSelectionContainer}>
                <Text style={styles.sectionTitle}>Sự kiện được chọn:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                    {events.map(event => (
                        <Chip 
                            key={event.event_id}
                            selected={selectedEvents.some(e => e.event_id === event.event_id)}
                            onPress={() => toggleEventSelection(event)}
                            style={[
                                styles.chip,
                                selectedEvents.some(e => e.event_id === event.event_id) ? styles.selectedChip : {}
                            ]}
                            textStyle={[
                                styles.chipText,
                                selectedEvents.some(e => e.event_id === event.event_id) ? styles.selectedChipText : {}
                            ]}
                        >
                            {event.event_name.substring(0, 20) + (event.event_name.length > 20 ? '...' : '')}
                        </Chip>
                    ))}
                </ScrollView>
            </View>
            
            {selectedEvents.length < 2 ? (
                <Card style={styles.messageCard}>
                    <Card.Content style={styles.messageContent}>
                        <MaterialCommunityIcons name="information" size={24} color="#007bff" />
                        <Text style={styles.messageText}>Vui lòng chọn ít nhất 2 sự kiện để so sánh</Text>
                    </Card.Content>
                </Card>
            ) : analyticsData.length < 2 ? (
                <ActivityIndicator style={styles.inlineLoader} size="small" color="#007bff" />
            ) : (
                <View>
                    <View style={styles.metricSelectionContainer}>
                        <Text style={styles.sectionTitle}>Phân tích theo:</Text>
                        <Menu
                            visible={metricMenuVisible}
                            onDismiss={() => setMetricMenuVisible(false)}
                            anchor={
                                <Button 
                                    mode="outlined" 
                                    onPress={() => setMetricMenuVisible(true)}
                                    style={styles.metricButton}
                                >
                                    {getMetricLabel()}
                                    <MaterialCommunityIcons name="chevron-down" size={20} color="#333" />
                                </Button>
                            }
                        >
                            <Menu.Item onPress={() => {setSelectedMetric('revenue'); setMetricMenuVisible(false);}} title="Doanh thu" />
                            <Menu.Item onPress={() => {setSelectedMetric('tickets'); setMetricMenuVisible(false);}} title="Số vé bán ra" />
                            <Menu.Item onPress={() => {setSelectedMetric('views'); setMetricMenuVisible(false);}} title="Lượt xem" />
                            <Menu.Item onPress={() => {setSelectedMetric('rating'); setMetricMenuVisible(false);}} title="Đánh giá" />
                            <Menu.Item onPress={() => {setSelectedMetric('conversion'); setMetricMenuVisible(false);}} title="Tỷ lệ chuyển đổi" />
                        </Menu>
                    </View>
                    
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>{`So sánh ${getMetricLabel().toLowerCase()} giữa các sự kiện`}</Text>
                        <BarChart
                            data={comparisonData}
                            width={screenWidth - 32}
                            height={220}
                            yAxisLabel=""
                            yAxisSuffix={getMetricSuffix()}
                            chartConfig={chartConfig}
                            style={styles.chart}
                            fromZero={true}
                            showValuesOnTopOfBars={true}
                        />
                    </View>
                    
                    {renderComparisonMetrics()}
                    
                    <View style={styles.notesContainer}>
                        <Text style={styles.notesTitle}>Ghi chú về màu sắc:</Text>
                        <View style={styles.noteItem}>
                            <View style={[styles.noteColor, {backgroundColor: '#007bff'}]} />
                            <Text style={styles.noteText}>Sự kiện 1: {analyticsData[0]?.event_name.substring(0, 15) || '-'}</Text>
                        </View>
                        <View style={styles.noteItem}>
                            <View style={[styles.noteColor, {backgroundColor: '#28a745'}]} />
                            <Text style={styles.noteText}>Sự kiện 2: {analyticsData[1]?.event_name.substring(0, 15) || '-'}</Text>
                        </View>
                        {analyticsData.length > 2 && (
                            <View style={styles.noteItem}>
                                <View style={[styles.noteColor, {backgroundColor: '#fd7e14'}]} />
                                <Text style={styles.noteText}>Sự kiện 3: {analyticsData[2]?.event_name.substring(0, 15) || '-'}</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f4f6f8',
        padding: 16,
    },
    headerContainer: {
        marginBottom: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#444',
        marginBottom: 10,
    },
    eventSelectionContainer: {
        marginBottom: 16,
    },
    chipContainer: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    chip: {
        marginRight: 8,
        height: 36,
    },
    selectedChip: {
        backgroundColor: '#e7f3ff',
        borderColor: '#007bff',
    },
    chipText: {
        fontSize: 13,
    },
    selectedChipText: {
        color: '#007bff',
    },
    messageCard: {
        marginVertical: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#007bff',
    },
    messageContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    messageText: {
        marginLeft: 10,
        fontSize: 14,
        color: '#333',
    },
    inlineLoader: {
        marginVertical: 20,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: 'red',
        textAlign: 'center',
        margin: 20,
    },
    metricSelectionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 16,
    },
    metricButton: {
        borderRadius: 8,
        borderColor: '#ddd',
    },
    chartContainer: {
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 16,
        borderRadius: 8,
        elevation: 2,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
        color: '#444',
    },
    chart: {
        marginVertical: 8,
        borderRadius: 8,
    },
    metricsCard: {
        marginBottom: 16,
        borderRadius: 8,
        elevation: 2,
    },
    divider: {
        marginVertical: 12,
    },
    metricCompareRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginVertical: 8,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    metricLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 0.3,
    },
    metricIcon: {
        marginRight: 6,
    },
    metricLabel: {
        fontSize: 14,
        color: '#555',
    },
    metricValuesContainer: {
        flexDirection: 'row',
        flex: 0.7,
        justifyContent: 'flex-end',
    },
    metricValueBox: {
        marginLeft: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        borderWidth: 1,
        minWidth: 70,
        alignItems: 'center',
    },
    metricValue: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    notesContainer: {
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 20,
        borderRadius: 8,
    },
    notesTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#444',
    },
    noteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    noteColor: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginRight: 8,
    },
    noteText: {
        fontSize: 12,
        color: '#555',
    },
});

export default ComparativeAnalytics;
