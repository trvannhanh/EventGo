import React, { useState, useContext } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import axios from 'axios';
import MyStyles from '../styles/MyStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../configs/Apis';
import { authApis } from '../../configs/Apis';
import { MyDispatchContext } from '../../configs/MyContexts';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const dispatch = useContext(MyDispatchContext);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const data = {
                grant_type: 'password',
                username,
                password,
                client_id: 'pD7UpIjBUdkylCiTFQ5oURKDu61S9DfpEpbX2sBZ',
                client_secret: 'eeN7xeN4jxCiGVN9HKI3j9NhNbHrJrbmlDVlCEvnhk5yV3d7uXwLbiUxfeHYIa3A2IhYAbrB9MQ8GHs30ARomfdwMiyy9olP5qlNzgaO4VE03efF7889NZqdgTqNYgIq'
            };
            const formBody = Object.entries(data).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
            const response = await axios.post(`${API_BASE}o/token/`, formBody, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            await AsyncStorage.setItem('token', response.data.access_token);
            
            
            const userRes = await authApis(response.data.access_token).get('users/current-user/');
            dispatch({ type: 'login', payload: userRes.data });
           
        
            Alert.alert('Thành công', 'Đăng nhập thành công!');
        } catch (error) {
            
            Alert.alert('Lỗi', 'Đăng nhập thất bại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={MyStyles.containerCenter}>
            <Text style={MyStyles.title}>Đăng nhập</Text>
            <TextInput
                style={MyStyles.input}
                placeholder="Tên đăng nhập"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
            />
            <TextInput
                style={MyStyles.input}
                placeholder="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            <Button title={loading ? 'Đang đăng nhập...' : 'Đăng nhập'} onPress={handleLogin} disabled={loading} />
        </View>
    );
}