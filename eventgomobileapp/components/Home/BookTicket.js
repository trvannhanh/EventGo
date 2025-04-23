import React, { useEffect, useState } from 'react';
import { ScrollView, ActivityIndicator, View, Alert } from 'react-native';
import { Card, Title, Paragraph, Button as PaperButton, RadioButton, TextInput as PaperTextInput } from 'react-native-paper';
import api, { endpoints } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApis } from '../../configs/Apis';

const BookTicket = ({ route, navigation }) => {
    const { eventId } = route.params;
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [quantity, setQuantity] = useState('1');
    const [discount, setDiscount] = useState('');
    const [booking, setBooking] = useState(false);

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                // console.log('eventId:', eventId);
                const res = await api.get(endpoints.eventDetail(eventId));
                // console.log('event detail:', res.data);
                setEvent(res.data);
                const ticketRes = await api.get(endpoints.ticketsOfEvent(eventId));
                // console.log('tickets:', ticketRes.data);
                setTickets(ticketRes.data);
            } catch (err) {
                // console.log('ERROR:', err, err.response?.data);
                setEvent(null);
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [eventId]);

    const handleBookTicket = async () => {
        if (!selectedTicket) {
            Alert.alert('Lỗi', 'Vui lòng chọn loại vé!');
            return;
        }
        setBooking(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await authApis(token).post(endpoints.bookTicket(eventId), {
                ticket_id: selectedTicket,
                quantity: parseInt(quantity),
                payment_method: 'MoMo',
                discount_code: discount || undefined,
            });
            Alert.alert('Thành công', 'Đặt vé thành công!');
            // Có thể chuyển sang màn hình vé hoặc hiển thị mã QR ở đây
        } catch (err) {
            Alert.alert('Lỗi', err.response?.data?.error || 'Đặt vé thất bại!');
        } finally {
            setBooking(false);
        }
    };

    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
    if (!event) return <Paragraph style={{ margin: 20, color: 'red' }}>Không tìm thấy sự kiện.</Paragraph>;

    return (
        <ScrollView>
            <Card style={{ margin: 16, padding: 16 }}>
                <Card.Content>
                    <Title>{event.name}</Title>
                    <Paragraph>Ngày: {event.date}</Paragraph>
                    <Paragraph>Địa điểm: {event.location}</Paragraph>
                    <Paragraph>Mô tả: {event.description}</Paragraph>
                    <Paragraph style={{ marginTop: 16, fontWeight: 'bold' }}>Chọn loại vé:</Paragraph>
                    <RadioButton.Group onValueChange={setSelectedTicket} value={selectedTicket}>
                        {tickets.map(ticket => (
                            <View key={ticket.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                <RadioButton value={ticket.id} />
                                <Paragraph>{ticket.type} - {ticket.price}đ (Còn {ticket.quantity})</Paragraph>
                            </View>
                        ))}
                    </RadioButton.Group>
                    <Paragraph style={{ marginTop: 8 }}>Số lượng:</Paragraph>
                    <PaperTextInput
                        mode="outlined"
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                        style={{ width: 100, marginBottom: 8 }}
                    />
                    <Paragraph>Mã giảm giá (nếu có):</Paragraph>
                    <PaperTextInput
                        mode="outlined"
                        value={discount}
                        onChangeText={setDiscount}
                        placeholder="Nhập mã giảm giá"
                        style={{ marginBottom: 8 }}
                    />
                </Card.Content>
                <Card.Actions>
                    <PaperButton mode="contained" onPress={handleBookTicket} loading={booking} disabled={booking}>
                        Đặt vé
                    </PaperButton>
                </Card.Actions>
            </Card>
        </ScrollView>
    );
};

export default BookTicket;
