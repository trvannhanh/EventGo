import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Event from './Event';
import MyStyles from '../styles/MyStyles';

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
        <View style={MyStyles.container}>
            <TextInput
                style={MyStyles.input}
                placeholder="Tìm kiếm sự kiện..."
                value={search}
                onChangeText={setSearch}
            />
            <Picker
                selectedValue={eventType}
                style={MyStyles.picker}
                onValueChange={(itemValue) => setEventType(itemValue)}
            >
                {EVENT_TYPES.map((type) => (
                    <Picker.Item key={type.value} label={type.label} value={type.value} />
                ))}
            </Picker>
            <Event navigation={navigation} search={search} eventType={eventType} />
        </View>
    );
};



export default Home;
