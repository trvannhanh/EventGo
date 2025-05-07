import React, { useState, useEffect, useContext } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform, TouchableOpacity, Image } from 'react-native';
import { TextInput, Button, Card, Title, Text, ActivityIndicator, Chip, HelperText } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { MyUserContext } from '../../configs/MyContexts';
import api, { endpoints, authApis } from '../../configs/Apis';
import MyStyles from '../styles/MyStyles';

const EVENT_TYPES = [
  { label: 'Âm nhạc', value: 'music' },
  { label: 'Hội thảo', value: 'conference' },
  { label: 'Thể thao', value: 'sports' },
  { label: 'Workshop', value: 'workshop' },
];

const CreateEvent = ({ navigation }) => {
  const user = useContext(MyUserContext);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [googleMapsLink, setGoogleMapsLink] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [eventType, setEventType] = useState('music');
  const [image, setImage] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  
  // Ticket states
  const [tickets, setTickets] = useState([
    { type: 'Vé thường', price: '', quantity: '' }
  ]);
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Loading and categories state
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  
  // Fetch event categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get(endpoints.eventCategories);
        setCategories(response.data);
        if (response.data.length > 0) {
          setCategoryId(response.data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        Alert.alert(
          'Lỗi',
          'Không thể tải danh mục sự kiện. Vui lòng thử lại sau.'
        );
      }
    };
    
    fetchCategories();
  }, []);
  
  // Image picker function
  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh.');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };
  
  // Handle date change
  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const currentDate = new Date(eventDate);
      selectedDate.setHours(currentDate.getHours());
      selectedDate.setMinutes(currentDate.getMinutes());
      setEventDate(selectedDate);
    }
  };
  
  // Handle time change
  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(eventDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setEventDate(newDate);
    }
  };
  
  // Handle adding new ticket type
  const addTicketType = () => {
    if (tickets.length < 3) {
      setTickets([...tickets, { type: '', price: '', quantity: '' }]);
    } else {
      Alert.alert('Thông báo', 'Bạn chỉ có thể tạo tối đa 3 loại vé cho một sự kiện.');
    }
  };
  
  // Handle removing ticket type
  const removeTicketType = (index) => {
    if (tickets.length > 1) {
      const newTickets = [...tickets];
      newTickets.splice(index, 1);
      setTickets(newTickets);
    } else {
      Alert.alert('Thông báo', 'Sự kiện phải có ít nhất một loại vé.');
    }
  };
  
  // Update ticket information
  const updateTicket = (index, field, value) => {
    const newTickets = [...tickets];
    newTickets[index] = { ...newTickets[index], [field]: value };
    setTickets(newTickets);
  };
  
  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!name.trim()) newErrors.name = 'Vui lòng nhập tên sự kiện';
    if (!description.trim()) newErrors.description = 'Vui lòng nhập mô tả sự kiện';
    if (!location.trim()) newErrors.location = 'Vui lòng nhập địa điểm';
    if (eventDate <= new Date()) newErrors.date = 'Ngày tổ chức phải sau thời điểm hiện tại';
    if (!image) newErrors.image = 'Vui lòng chọn ảnh cho sự kiện';
    
    // Validate tickets
    const ticketErrors = [];
    tickets.forEach((ticket, index) => {
      const ticketError = {};
      if (!ticket.type.trim()) ticketError.type = 'Vui lòng nhập loại vé';
      if (!ticket.price || isNaN(ticket.price) || parseInt(ticket.price) <= 0) 
        ticketError.price = 'Giá vé phải là số dương';
      if (!ticket.quantity || isNaN(ticket.quantity) || parseInt(ticket.quantity) <= 0) 
        ticketError.quantity = 'Số lượng vé phải là số dương';
      
      if (Object.keys(ticketError).length > 0) {
        ticketErrors[index] = ticketError;
      }
    });
    
    if (ticketErrors.length > 0) newErrors.tickets = ticketErrors;
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Submit event creation
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Lỗi', 'Vui lòng kiểm tra lại thông tin đã nhập');
      return;
    }
    
    if (!user || !user.access_token) {
      Alert.alert('Lỗi', 'Bạn cần đăng nhập để thực hiện chức năng này');
      return;
    }
    
    try {
      setLoading(true);
      const authApi = authApis(user.access_token);
      
      // Prepare event data
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('date', eventDate.toISOString());
      formData.append('location', location);
      formData.append('category', categoryId);
      
      if (googleMapsLink) {
        formData.append('google_maps_link', googleMapsLink);
      }
      
      // Calculate total tickets
      const totalTickets = tickets.reduce((sum, t) => sum + parseInt(t.quantity || 0), 0);
      formData.append('ticket_limit', totalTickets);
      
      // Add image
      if (image) {
        const filename = image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const fileType = match ? `image/${match[1]}` : 'image';
        
        formData.append('image', {
          uri: image,
          name: filename,
          type: fileType,
        });
      }
      
      // Create the event
      const eventResponse = await authApi.post(endpoints.createEvent, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const eventId = eventResponse.data.id;
      
      // Create tickets for the event
      for (const ticket of tickets) {
        await authApi.post(endpoints.createTicket(eventId), {
          type: ticket.type,
          price: ticket.price,
          quantity: ticket.quantity,
        });
      }
      
      Alert.alert(
        'Thành công',
        'Sự kiện đã được tạo thành công!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      
    } catch (error) {
      console.error('Error creating event:', error.response?.data || error.message);
      Alert.alert(
        'Lỗi',
        'Không thể tạo sự kiện. Vui lòng thử lại sau.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7FC8C2" />
        <Text style={styles.loadingText}>Đang tạo sự kiện...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.title}>Tạo sự kiện mới</Title>
          
          {/* Event Basic Information */}
          <TextInput
            label="Tên sự kiện"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.input}
            error={!!errors.name}
          />
          {errors.name && <HelperText type="error">{errors.name}</HelperText>}
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Loại sự kiện:</Text>
            <Picker
              selectedValue={eventType}
              style={styles.picker}
              onValueChange={(itemValue) => setEventType(itemValue)}
            >
              {EVENT_TYPES.map((type) => (
                <Picker.Item key={type.value} label={type.label} value={type.value} />
              ))}
            </Picker>
          </View>
          
          {categories.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Danh mục:</Text>
              <Picker
                selectedValue={categoryId}
                style={styles.picker}
                onValueChange={(itemValue) => setCategoryId(itemValue)}
              >
                {categories.map((category) => (
                  <Picker.Item key={category.id} label={category.name} value={category.id} />
                ))}
              </Picker>
            </View>
          )}
          
          <TextInput
            label="Mô tả sự kiện"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={styles.input}
            error={!!errors.description}
          />
          {errors.description && <HelperText type="error">{errors.description}</HelperText>}
          
          {/* Date and Time */}
          <View style={styles.dateTimeContainer}>
            <Text style={styles.label}>Ngày tổ chức:</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton} 
              onPress={() => setShowDatePicker(true)}
            >
              <Text>{eventDate.toLocaleDateString()}</Text>
              <Ionicons name="calendar" size={20} color="#7FC8C2" />
            </TouchableOpacity>
            
            <Text style={styles.label}>Giờ bắt đầu:</Text>
            <TouchableOpacity 
              style={styles.dateTimeButton} 
              onPress={() => setShowTimePicker(true)}
            >
              <Text>{eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              <Ionicons name="time" size={20} color="#7FC8C2" />
            </TouchableOpacity>
          </View>
          {errors.date && <HelperText type="error">{errors.date}</HelperText>}
          
          {showDatePicker && (
            <DateTimePicker
              value={eventDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          )}
          
          {showTimePicker && (
            <DateTimePicker
              value={eventDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
            />
          )}
          
          {/* Location */}
          <TextInput
            label="Địa điểm"
            value={location}
            onChangeText={setLocation}
            mode="outlined"
            style={styles.input}
            error={!!errors.location}
          />
          {errors.location && <HelperText type="error">{errors.location}</HelperText>}
          
          <TextInput
            label="Đường dẫn Google Maps (tùy chọn)"
            value={googleMapsLink}
            onChangeText={setGoogleMapsLink}
            mode="outlined"
            style={styles.input}
            placeholder="https://maps.google.com/..."
          />
          
          {/* Event Image */}
          <Text style={styles.label}>Hình ảnh sự kiện:</Text>
          <View style={styles.imageContainer}>
            {image ? (
              <Image source={{ uri: image }} style={styles.eventImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <MaterialIcons name="image" size={50} color="#ccc" />
              </View>
            )}
            <Button 
              mode="contained" 
              onPress={pickImage} 
              style={styles.imageButton}
            >
              {image ? 'Thay đổi ảnh' : 'Chọn ảnh'}
            </Button>
          </View>
          {errors.image && <HelperText type="error">{errors.image}</HelperText>}
          
          {/* Ticket Information */}
          <View style={styles.ticketsContainer}>
            <View style={styles.ticketHeader}>
              <Text style={styles.sectionTitle}>Thông tin vé</Text>
              <Button 
                mode="contained" 
                onPress={addTicketType} 
                compact
                style={styles.addButton}
              >
                Thêm loại vé
              </Button>
            </View>
            
            {tickets.map((ticket, index) => (
              <Card key={index} style={styles.ticketCard}>
                <Card.Content>
                  <View style={styles.ticketCardHeader}>
                    <Text style={styles.ticketTitle}>Loại vé {index + 1}</Text>
                    {tickets.length > 1 && (
                      <TouchableOpacity onPress={() => removeTicketType(index)}>
                        <MaterialIcons name="delete" size={24} color="#FF6B6B" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <TextInput
                    label="Tên loại vé"
                    value={ticket.type}
                    onChangeText={(text) => updateTicket(index, 'type', text)}
                    mode="outlined"
                    style={styles.input}
                    error={errors.tickets && errors.tickets[index]?.type}
                  />
                  {errors.tickets && errors.tickets[index]?.type && (
                    <HelperText type="error">{errors.tickets[index].type}</HelperText>
                  )}
                  
                  <TextInput
                    label="Giá vé (VNĐ)"
                    value={ticket.price}
                    onChangeText={(text) => updateTicket(index, 'price', text)}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                    error={errors.tickets && errors.tickets[index]?.price}
                  />
                  {errors.tickets && errors.tickets[index]?.price && (
                    <HelperText type="error">{errors.tickets[index].price}</HelperText>
                  )}
                  
                  <TextInput
                    label="Số lượng vé"
                    value={ticket.quantity}
                    onChangeText={(text) => updateTicket(index, 'quantity', text)}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                    error={errors.tickets && errors.tickets[index]?.quantity}
                  />
                  {errors.tickets && errors.tickets[index]?.quantity && (
                    <HelperText type="error">{errors.tickets[index].quantity}</HelperText>
                  )}
                </Card.Content>
              </Card>
            ))}
          </View>
          
          {/* Submit Button */}
          <Button 
            mode="contained" 
            onPress={handleSubmit} 
            style={styles.submitButton}
          >
            Tạo sự kiện
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#777',
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#444',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
    color: '#555',
  },
  picker: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  dateTimeContainer: {
    marginBottom: 12,
  },
  dateTimeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  eventImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageButton: {
    marginTop: 4,
    backgroundColor: '#7FC8C2',
  },
  ticketsContainer: {
    marginTop: 20,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#444',
  },
  addButton: {
    backgroundColor: '#7FC8C2',
  },
  ticketCard: {
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 12,
    paddingVertical: 6,
    backgroundColor: '#7FC8C2',
  },
});

export default CreateEvent;