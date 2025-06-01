// eventgomobileapp/components/Dashboard/AnalyticsExport.js
import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, Platform, Share } from 'react-native';
import { Button, Divider, Menu, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format as formatDate } from 'date-fns';

// Export utility component for analytics data
const AnalyticsExport = ({ data, isEventDetail = false, eventName = '' }) => {
    const [menuVisible, setMenuVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const openMenu = () => setMenuVisible(true);
    const closeMenu = () => setMenuVisible(false);    // Prepare filename for export
    const getFileName = (fileFormat) => {
        const date = formatDate(new Date(), 'yyyy-MM-dd');
        const prefix = isEventDetail ? `EventAnalytics_${eventName.replace(/[^a-zA-Z0-9]/g, '_')}` : 'DashboardAnalytics';
        return `${prefix}_${date}.${fileFormat}`;
    };
      // Generate CSV content from data
    const generateCSV = () => {
        if (!data) return '';
        
        // Helper function to escape CSV values (handle commas, quotes, etc.)
        const escapeCSV = (value) => {
            const stringValue = String(value);
            // If the value contains comma, quote, or new line, wrap it in quotes
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                // Double up quotes to escape them
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };
        
        let csvContent = '';
        let headers = [];
        let values = [];
        
        if (isEventDetail) {
            // For individual event analytics
            headers = [
                'Tên sự kiện', 'Ngày bắt đầu', 'Tổng doanh thu', 'Vé bán ra',
                'Đánh giá trung bình', 'Lượt xem', 'Tỷ lệ chuyển đổi', 'Điểm quan tâm'
            ];
              values = [                
                escapeCSV(data.event_name),
                escapeCSV(data.event_start_date ? formatDate(new Date(data.event_start_date), 'dd/MM/yyyy') : ''),
                escapeCSV(data.total_revenue || 0),
                escapeCSV(data.tickets_sold || 0),
                escapeCSV(data.average_rating || 0),
                escapeCSV(data.event_views || 0),
                escapeCSV(`${data.conversion_rate || 0}%`),
                escapeCSV(data.event_interest_score || 0)
            ];
              // Add headers and values
            csvContent = headers.join(',') + '\n' + values.join(',') + '\n\n';
            
            // Add ticket breakdown
            if (data.tickets_breakdown && data.tickets_breakdown.length > 0) {
                csvContent += '\nPhân bố vé,\n';
                csvContent += 'Loại vé,Giá vé,Số lượng đã bán,Doanh thu\n';
                  data.tickets_breakdown.forEach(ticket => {
                    csvContent += `${escapeCSV(ticket.ticket_type)},${escapeCSV(ticket.ticket_price)},${escapeCSV(ticket.quantity_sold)},${escapeCSV(ticket.revenue)}\n`;
                });
            }
            
            // Add views by day
            if (data.views_by_day && data.views_by_day.length > 0) {
                csvContent += '\nLượt xem theo ngày,\n';
                csvContent += 'Ngày,Lượt xem\n';
                
                data.views_by_day.forEach(day => {
                    csvContent += `${escapeCSV(day.date)},${escapeCSV(day.count)}\n`;
                });
            }
        } else {            // For dashboard analytics (either organizer or admin)
            if (data[0] && data[0].organizer_username) {
                // Admin view with organizer data
                csvContent = 'Tên tổ chức,Email,Số sự kiện,Doanh thu,Vé bán ra,Lượt xem,Đánh giá trung bình\n';
                  data.forEach(organizer => {
                    csvContent += `${escapeCSV(organizer.organizer_username)},${escapeCSV(organizer.organizer_email)},${escapeCSV(organizer.total_events || 0)},${escapeCSV(organizer.aggregated_total_revenue || 0)},${escapeCSV(organizer.aggregated_total_tickets_sold || 0)},${escapeCSV(organizer.total_event_views || 0)},${escapeCSV(organizer.average_event_rating || 0)}\n`;
                });
            } else {
                // Organizer view with event data
                csvContent = 'Tên sự kiện,Doanh thu,Vé bán ra,Lượt xem,Đánh giá trung bình\n';
                
                data.forEach(event => {
                    csvContent += `${escapeCSV(event.event_name)},${escapeCSV(event.total_revenue || 0)},${escapeCSV(event.tickets_sold || 0)},${escapeCSV(event.event_views || 0)},${escapeCSV(event.average_rating || 0)}\n`;
                });
            }
        }
        
        return csvContent;
    };
      // Export data as CSV file
    const exportCSV = async () => {
        try {
            setLoading(true);
            closeMenu();
            
            // Generate CSV content
            const csvContent = generateCSV();
            if (!csvContent) {
                throw new Error('Không thể tạo nội dung CSV');
            }

            // Get file name and create file URI
            const fileName = getFileName('csv');
            console.log(`Creating CSV file: ${fileName}`);
            
            // Make sure documentDirectory exists and is accessible
            const fileExists = await FileSystem.getInfoAsync(FileSystem.documentDirectory);
            if (!fileExists.exists) {
                console.log("Document directory doesn't exist or isn't accessible");
                throw new Error("Không thể truy cập thư mục lưu trữ");
            }
            
            const fileUri = `${FileSystem.documentDirectory}${fileName}`;
            
            // Write file with UTF8 encoding
            console.log(`Writing to file: ${fileUri}`);
            await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                encoding: FileSystem.EncodingType.UTF8
            });
            
            // Check if file was created successfully
            const createdFile = await FileSystem.getInfoAsync(fileUri);
            if (!createdFile.exists) {
                throw new Error("Không thể tạo file");
            }
            
            console.log(`File created successfully. Size: ${createdFile.size} bytes`);
            
            // Share the file
            if (Platform.OS === 'android' || Platform.OS === 'ios') {
                const isShareAvailable = await Sharing.isAvailableAsync();
                console.log(`Sharing available: ${isShareAvailable}`);
                
                if (isShareAvailable) {
                    await Sharing.shareAsync(fileUri, {
                        mimeType: 'text/csv',
                        dialogTitle: 'Chia sẻ báo cáo phân tích',
                        UTI: 'public.comma-separated-values-text'
                    });
                } else {
                    // Fallback to Share API if Sharing extension isn't available
                    await Share.share({
                        title: 'Báo cáo phân tích dữ liệu',
                        message: csvContent,
                    });
                }
            }
            
            Alert.alert('Xuất thành công', `Dữ liệu đã được xuất thành công dưới dạng ${fileName}`);
        } catch (error) {
            console.error('Export error:', error);
            Alert.alert('Lỗi xuất dữ liệu', `Không thể xuất dữ liệu: ${error.message || 'Lỗi không xác định'}. Vui lòng thử lại sau.`);
        } finally {
            setLoading(false);
        }
    };
    
    // Generate summary text for sharing
    const generateTextSummary = () => {
        let summary = '';
        
        if (isEventDetail) {
            summary = `Báo cáo sự kiện: ${data.event_name}\n`;            summary += `Ngày: ${data.event_start_date ? formatDate(new Date(data.event_start_date), 'dd/MM/yyyy') : 'N/A'}\n`;
            summary += `Doanh thu: ${data.total_revenue || 0} VND\n`;
            summary += `Vé bán ra: ${data.tickets_sold || 0}\n`;
            summary += `Đánh giá: ${data.average_rating || 0}/5\n`;
            summary += `Lượt xem: ${data.event_views || 0}\n`;
            summary += `Tỷ lệ chuyển đổi: ${data.conversion_rate || 0}%\n`;
        } else {
            summary = `Báo cáo thống kê EventGo\n`;
            summary += `Ngày xuất: ${formatDate(new Date(), 'dd/MM/yyyy')}\n\n`;
            
            if (data[0] && data[0].organizer_username) {
                // Admin view
                data.forEach(organizer => {
                    summary += `Tổ chức: ${organizer.organizer_username}\n`;
                    summary += `Số sự kiện: ${organizer.total_events || 0}\n`;
                    summary += `Doanh thu: ${organizer.aggregated_total_revenue || 0} VND\n`;
                    summary += `Vé bán ra: ${organizer.aggregated_total_tickets_sold || 0}\n`;
                    summary += `Đánh giá: ${organizer.average_event_rating || 0}/5\n\n`;
                });
            } else {
                // Organizer view
                data.forEach(event => {
                    summary += `Sự kiện: ${event.event_name}\n`;
                    summary += `Doanh thu: ${event.total_revenue || 0} VND\n`;
                    summary += `Vé bán ra: ${event.tickets_sold || 0}\n`;
                    summary += `Đánh giá: ${event.average_rating || 0}/5\n\n`;
                });
            }
        }
        
        return summary;
    };
    
    // Share summary text
    const shareTextSummary = async () => {
        try {
            setLoading(true);
            closeMenu();
            
            const summary = generateTextSummary();
            
            await Share.share({
                title: isEventDetail ? `Báo cáo sự kiện: ${data.event_name}` : 'Báo cáo thống kê EventGo',
                message: summary,
            });
        } catch (error) {
            console.error('Share error:', error);
            Alert.alert('Lỗi chia sẻ', 'Không thể chia sẻ báo cáo. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };
    
    if (!data) {
        return null;
    }
    
    return (
        <View style={styles.container}>
            <Menu
                visible={menuVisible}
                onDismiss={closeMenu}
                anchor={
                    <Button 
                        mode="outlined" 
                        onPress={openMenu} 
                        style={styles.exportButton}
                        labelStyle={styles.buttonLabel}
                        icon={({size, color}) => (
                            <MaterialCommunityIcons name="export" size={size} color={color} />
                        )}
                    >
                        Xuất báo cáo
                    </Button>
                }
            >
                <Menu.Item 
                    onPress={exportCSV} 
                    title="Xuất CSV" 
                    leadingIcon="file-document-outline"
                />
                <Divider />
                <Menu.Item 
                    onPress={shareTextSummary} 
                    title="Chia sẻ báo cáo" 
                    leadingIcon="share-variant"
                />
            </Menu>
            
            {loading && <ActivityIndicator style={styles.loader} size="small" color="#007bff" />}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    exportButton: {
        borderColor: '#007bff',
        borderRadius: 8,
    },
    buttonLabel: {
        color: '#007bff',
        fontSize: 14,
    },
    loader: {
        marginLeft: 10,
    }
});

export default AnalyticsExport;
