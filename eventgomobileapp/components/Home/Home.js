import React, { useState, useContext } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Event from './Event';
import MyStyles from '../styles/MyStyles';
import { Card, Title, TextInput as PaperTextInput, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MyUserContext } from '../../configs/MyContexts';

const EVENT_TYPES = [
    { label: 'Tất cả', value: '' },
    { label: 'Âm nhạc', value: 'music' },
    { label: 'Hội thảo', value: 'seminar' },
    { label: 'Thể thao', value: 'sport' },
];

const Home = ({ navigation }) => {
    const [search, setSearch] = useState('');
    const [eventType, setEventType] = useState('');
    const user = useContext(MyUserContext);
    
    // Check if user is an organizer
    const isOrganizer = user && (user.role === 'organizer' || user.role === 'admin');

    // Xử lý chức năng tạo sự kiện
    const handleCreateEvent = () => {
        // Ensure only organizers and admins can create events
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
        <View style={{ flex: 1 }}>
            <Card style={MyStyles.cardPastel}>
                <Card.Content>
                    <View style={{ alignItems: 'center', marginBottom: 12 }}>
                        <MaterialCommunityIcons name="magnify" size={40} style={MyStyles.iconPastel} />
                    </View>
                    <Title style={MyStyles.titlePastel}>Tìm kiếm sự kiện</Title>
                    <PaperTextInput
                        mode="outlined"
                        label="Tìm kiếm sự kiện..."
                        value={search}
                        onChangeText={setSearch}
                        style={MyStyles.inputPastel}
                        outlineColor="#A49393"
                        activeOutlineColor="#A49393"
                        textColor="#222"
                    />
                    <Picker
                        selectedValue={eventType}
                        style={[MyStyles.inputPastel, { borderRadius: 8 }]}
                        onValueChange={(itemValue) => setEventType(itemValue)}
                    >
                        {EVENT_TYPES.map((type) => (
                            <Picker.Item key={type.value} label={type.label} value={type.value} />
                        ))}
                    </Picker>
                </Card.Content>
            </Card>
            <Event navigation={navigation} search={search} eventType={eventType} />

            {/* Create Event button (only visible for organizers) */}
            {isOrganizer && (
                <FAB
                    style={styles.fab}
                    icon="plus"
                    label="Tạo sự kiện"
                    onPress={handleCreateEvent}
                    color="#fff"
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
        backgroundColor: '#A49393',
    },
});

export default Home;
