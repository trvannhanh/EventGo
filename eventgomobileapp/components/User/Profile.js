import React, { useContext, useState } from 'react';
import { View, Text, Alert, Image } from 'react-native';
import MyStyles from '../styles/MyStyles';
import { MyUserContext, MyDispatchContext } from '../../configs/MyContexts';
import * as ImagePicker from 'expo-image-picker';
import { authApis } from '../../configs/Apis';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button as PaperButton, TextInput as PaperTextInput, Card, Avatar, Title, Paragraph } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Profile() {
    const user = useContext(MyUserContext);
    const dispatch = useContext(MyDispatchContext);
    const [phone, setPhone] = useState(user?.phone || '');
    const [avatar, setAvatar] = useState(user?.avatar || null);
    const [updating, setUpdating] = useState(false);

    const handleLogout = () => {
        dispatch({ type: 'logout' });
        Alert.alert('Đăng xuất', 'Bạn đã đăng xuất thành công!');
    };

    const pickImage = async () => {
        
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: false,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });
        
        if (!result.canceled) {
            setAvatar(result.assets[0].uri);
        }
    };

    const handleUpdate = async () => {
        setUpdating(true);
        try {
            const token = await AsyncStorage.getItem('token');
            let formData = new FormData();
            formData.append('phone', phone);
            if (avatar && avatar !== user.avatar) {
                const filename = avatar.split('/').pop();
                const match = /\.([\w]+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : `image`;
                formData.append('avatar', { uri: avatar, name: filename, type });
            }
            const res = await authApis(token).patch('users/update-current-user/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            dispatch({ type: 'login', payload: res.data });
            Alert.alert('Thành công', 'Cập nhật thông tin thành công!');
        } catch (err) {
            Alert.alert('Lỗi', 'Cập nhật thất bại!');
        } finally {
            setUpdating(false);
        }
    };

    if (!user) {
        return (
            <View style={MyStyles.containerCenter}>
                <Text style={MyStyles.title}>Bạn chưa đăng nhập</Text>
            </View>
        );
    }

    return (
        
        <Card style={MyStyles.cardPastel}>
            <Card.Content>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <MaterialCommunityIcons name="account-circle" size={48} style={MyStyles.iconPastel} />
                </View>
                <Title style={MyStyles.titlePastel}>Thông tin tài khoản</Title>
                <Avatar.Image
                    size={100}
                    source={
                        avatar
                            ? (avatar.startsWith('http')
                                ? { uri: avatar }
                                : { uri: `https://res.cloudinary.com/dqpkxxzaf/${avatar}` })
                            : require('../../assets/icon.png')
                    }
                    style={MyStyles.avatarPastel}
                />
                <PaperButton mode="outlined" onPress={pickImage} style={MyStyles.buttonOutlinePastel} labelStyle={MyStyles.buttonLabelDark}>
                    Chọn ảnh đại diện
                </PaperButton>
                <Paragraph style={MyStyles.labelPastel}>Tên đăng nhập: <Text style={MyStyles.textDark}>{user.username}</Text></Paragraph>
                <Paragraph style={MyStyles.labelPastel}>Email: <Text style={MyStyles.textDark}>{user.email}</Text></Paragraph>
                <Paragraph style={MyStyles.labelPastel}>Vai trò: <Text style={MyStyles.textDark}>{user.role}</Text></Paragraph>
                <Paragraph style={MyStyles.labelPastel}>Số điện thoại:</Paragraph>
                <PaperTextInput
                    mode="outlined"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Nhập số điện thoại"
                    keyboardType="phone-pad"
                    style={MyStyles.inputPastel}
                    outlineColor="#A49393"
                    activeOutlineColor="#A49393"
                    textColor="#222"
                />
                <PaperButton mode="contained" onPress={handleUpdate} loading={updating} disabled={updating} style={MyStyles.buttonPastel} labelStyle={MyStyles.buttonLabelLight}>
                    Cập nhật
                </PaperButton>
                <PaperButton mode="outlined" onPress={handleLogout} style={MyStyles.buttonOutlinePastel} labelStyle={MyStyles.buttonLabelDark}>
                    Đăng xuất
                </PaperButton>
            </Card.Content>
        </Card>
    );
}
