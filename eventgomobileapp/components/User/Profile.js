import React, { useContext, useState, useEffect } from 'react';
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
    const [avatarKey, setAvatarKey] = useState(Date.now()); // Thêm state để force re-render Avatar

    // Thêm useEffect để cập nhật avatar khi user thay đổi
    useEffect(() => {
        if (user?.avatar) {
            setAvatar(user.avatar);
            setAvatarKey(Date.now()); // Cập nhật key để force re-render
        }
    }, [user]);

    // Helper function để tạo URL chính xác cho avatar
    const getAvatarUri = (avatarPath) => {
        if (!avatarPath) return null;
        
        // Nếu là URI cục bộ từ thư viện ảnh (file:// hoặc content://)
        if (avatarPath.startsWith('file://') || avatarPath.startsWith('content://')) {
            return avatarPath;
        }
        
        // Nếu đã là URL đầy đủ
        if (avatarPath.startsWith('http')) {
            return avatarPath;
        }
        
        // Nếu là đường dẫn relative trong Cloudinary
        if (avatarPath.includes('cloudinary') || avatarPath.includes('upload')) {
            return `https://res.cloudinary.com/dqpkxxzaf/${avatarPath}`;
        }
        
        // Nếu chỉ là tên file (trường hợp từ media trong Django)
        return `http://192.168.1.41:8000/media/${avatarPath}`;
    };

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
            setAvatarKey(Date.now()); // Cập nhật key để force re-render Avatar
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
                    key={avatarKey} // Thêm key để force re-render Avatar
                    size={100}
                    source={
                        avatar
                            ? { uri: getAvatarUri(avatar) }
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
