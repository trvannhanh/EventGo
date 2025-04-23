import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Event from './Event';
import MyStyles from '../styles/MyStyles';
import { Card, Title, TextInput as PaperTextInput, Button as PaperButton, Paragraph } from 'react-native-paper';

const EVENT_TYPES = [
    { label: 'Tất cả', value: '' },
    { label: 'Âm nhạc', value: 'music' },
    { label: 'Hội thảo', value: 'seminar' },
    { label: 'Thể thao', value: 'sport' },
];

const Home = ({ navigation }) => {
    const [search, setSearch] = useState('');
    const [eventType, setEventType] = useState('');

    return (
        <View style={{ flex: 1 }}>
            <Card style={{ margin: 16, padding: 16 }}>
                <Card.Content>
                    <Title style={{ textAlign: 'center', marginBottom: 12 }}>Tìm kiếm sự kiện</Title>
                    <PaperTextInput
                        mode="outlined"
                        label="Tìm kiếm sự kiện..."
                        value={search}
                        onChangeText={setSearch}
                        style={{ marginBottom: 16 }}
                    />
                    <Picker
                        selectedValue={eventType}
                        style={{ marginBottom: 16 }}
                        onValueChange={(itemValue) => setEventType(itemValue)}
                    >
                        {EVENT_TYPES.map((type) => (
                            <Picker.Item key={type.value} label={type.label} value={type.value} />
                        ))}
                    </Picker>
                </Card.Content>
            </Card>
            <Event navigation={navigation} search={search} eventType={eventType} />
        </View>
    );
};

export default Home;
