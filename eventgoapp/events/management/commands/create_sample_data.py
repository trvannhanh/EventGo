import random
import uuid
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.timezone import now
from django.contrib.auth.hashers import make_password
from decimal import Decimal
from events.models import (
    User, EventCategory, Event, TicketType, Order, OrderDetail, 
    Review, Discount, Notification, EventTrend
)
from django.db import transaction

class Command(BaseCommand):
    help = 'Create sample data for EventGo application'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample data...')
        
        try:
            with transaction.atomic():
                self.create_users()
                self.create_categories()
                self.create_events()
                self.create_tickets()
                self.create_orders()
                self.create_reviews()
                self.create_discounts()
                self.create_notifications()                
                self.create_event_trends()
                
            self.stdout.write(self.style.SUCCESS('✅ Sample data created successfully!'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error creating sample data: {e}'))
    
    def create_users(self):
        # Admin user
        if not User.objects.filter(username='admin').exists():
            User.objects.create(
                username='admin',
                password=make_password('Admin@123'),
                email='admin@eventgo.com',
                first_name='Admin',
                last_name='User',
                role=User.Role.ADMIN,
                is_staff=True,
                is_superuser=True
            )
            self.stdout.write('Created admin user')
        
        # Organizer users
        organizers = [
            {
                'username': 'organizer1',
                'password': 'Organizer@123',
                'email': 'organizer1@eventgo.com',
                'first_name': 'John',
                'last_name': 'Doe',
                'phone': '0901234567',
                'address': 'Ho Chi Minh City, Vietnam'
            },
            {
                'username': 'organizer2',
                'password': 'Organizer@123',
                'email': 'organizer2@eventgo.com',
                'first_name': 'Jane',
                'last_name': 'Smith',
                'phone': '0912345678',
                'address': 'Hanoi, Vietnam'
            }
        ]
        
        for org_data in organizers:
            if not User.objects.filter(username=org_data['username']).exists():
                User.objects.create(
                    username=org_data['username'],
                    password=make_password(org_data['password']),
                    email=org_data['email'],
                    first_name=org_data['first_name'],
                    last_name=org_data['last_name'],
                    phone=org_data['phone'],
                    address=org_data['address'],
                    role=User.Role.ORGANIZER
                )
        self.stdout.write('Created organizer users')
        
        # Attendee users
        attendees = [
            {
                'username': 'attendee1',
                'password': 'Attendee@123',
                'email': 'attendee1@gmail.com',
                'first_name': 'Nguyen',
                'last_name': 'Van A',
                'phone': '0923456789',
                'address': 'District 1, HCMC, Vietnam'
            },
            {
                'username': 'attendee2',
                'password': 'Attendee@123',
                'email': 'attendee2@gmail.com',
                'first_name': 'Tran',
                'last_name': 'Thi B',
                'phone': '0934567890',
                'address': 'District 2, HCMC, Vietnam'
            },
            {
                'username': 'attendee3',
                'password': 'Attendee@123',
                'email': 'attendee3@gmail.com',
                'first_name': 'Le',
                'last_name': 'Van C',
                'phone': '0945678901',
                'address': 'District 7, HCMC, Vietnam'
            },
            {
                'username': 'attendee4',
                'password': 'Attendee@123',
                'email': 'attendee4@gmail.com',
                'first_name': 'Pham',
                'last_name': 'Thi D',
                'phone': '0956789012',
                'address': 'Cau Giay, Hanoi, Vietnam'
            },
            {
                'username': 'attendee5',
                'password': 'Attendee@123',
                'email': 'attendee5@gmail.com',
                'first_name': 'Hoang',
                'last_name': 'Van E',
                'phone': '0967890123',
                'address': 'Hai Chau, Da Nang, Vietnam'
            }
        ]
        
        for att_data in attendees:
            if not User.objects.filter(username=att_data['username']).exists():
                User.objects.create(
                    username=att_data['username'],
                    password=make_password(att_data['password']),
                    email=att_data['email'],
                    first_name=att_data['first_name'],
                    last_name=att_data['last_name'],
                    phone=att_data['phone'],
                    address=att_data['address'],
                    role=User.Role.ATTENDEE
                )
        self.stdout.write('Created attendee users')
    
    def create_categories(self):
        categories = [
            'Âm nhạc',
            'Hội nghị',
            'Thể thao',
            'Giáo dục',
            'Công nghệ',
            'Kinh doanh',
            'Nghệ thuật',
            'Du lịch',
            'Ẩm thực',
            'Sức khỏe & Làm đẹp'
        ]
        
        for category_name in categories:
            EventCategory.objects.get_or_create(name=category_name)
        
        self.stdout.write('Created event categories')
    
    def create_events(self):
        organizers = User.objects.filter(role=User.Role.ORGANIZER)
        categories = EventCategory.objects.all()
        
        if not organizers or not categories:
            self.stdout.write(self.style.WARNING('Skipping events: No organizers or categories found'))
            return
        
        events = [
            {
                'name': 'Lễ hội âm nhạc Hello Summer 2025',
                'description': '<p>Lễ hội âm nhạc lớn nhất mùa hè với sự góp mặt của nhiều ca sĩ nổi tiếng trong và ngoài nước.</p><p>Đây là cơ hội để bạn được đắm mình trong không gian âm nhạc đầy màu sắc và năng lượng.</p>',
                'date': timezone.now() + timedelta(days=30),
                'location': 'Công viên Lê Văn Tám, Quận 1, TP.HCM',
                'google_maps_link': 'https://maps.app.goo.gl/HjQTEV6G8j9yxqXo6',
                'ticket_limit': 1000,
                'status': Event.EventStatus.UPCOMING,
                'category_name': 'Âm nhạc'
            },
            {
                'name': 'Tech Summit Vietnam 2025',
                'description': '<p>Sự kiện công nghệ đỉnh cao quy tụ các chuyên gia hàng đầu trong lĩnh vực AI, Blockchain, và IoT.</p><p>Cơ hội kết nối với các nhà lãnh đạo công nghệ và đón đầu xu hướng mới nhất.</p>',
                'date': timezone.now() + timedelta(days=45),
                'location': 'GEM Center, 8 Nguyễn Bỉnh Khiêm, Quận 1, TP.HCM',
                'google_maps_link': 'https://maps.app.goo.gl/DLc5Ypej5FCobM3V6',
                'ticket_limit': 500,
                'status': Event.EventStatus.UPCOMING,
                'category_name': 'Công nghệ'
            },
            {
                'name': 'Vietnam Web Summit 2025',
                'description': '<p>Hội nghị về phát triển web lớn nhất Việt Nam, nơi quy tụ những nhân tài trong lĩnh vực phát triển web.</p><p>Khám phá các công nghệ web mới nhất và chia sẻ kinh nghiệm với cộng đồng.</p>',
                'date': timezone.now() + timedelta(days=60),
                'location': 'White Palace, 194 Hoàng Văn Thụ, Phú Nhuận, TP.HCM',
                'google_maps_link': 'https://maps.app.goo.gl/9HT6MfptHZjEYi2V6',
                'ticket_limit': 300,
                'status': Event.EventStatus.UPCOMING,
                'category_name': 'Công nghệ'
            },
            {
                'name': 'Marathon TP.HCM 2025',
                'description': '<p>Giải chạy Marathon thường niên lớn nhất tại TP.HCM.</p><p>Hãy tham gia cùng hàng nghìn vận động viên khác trong một hành trình đầy thử thách và cảm hứng.</p>',
                'date': timezone.now() + timedelta(days=75),
                'location': 'Khu đô thị Thủ Thiêm, Quận 2, TP.HCM',
                'google_maps_link': 'https://maps.app.goo.gl/nBSLaXNyEuL6BFJY6',
                'ticket_limit': 2000,
                'status': Event.EventStatus.UPCOMING,
                'category_name': 'Thể thao'
            },
            {
                'name': 'Triển lãm nghệ thuật đương đại',
                'description': '<p>Triển lãm giới thiệu các tác phẩm nghệ thuật đương đại từ các nghệ sĩ trẻ Việt Nam.</p><p>Cơ hội để trải nghiệm và hiểu thêm về nghệ thuật đương đại Việt Nam.</p>',
                'date': timezone.now() + timedelta(days=15),
                'location': 'VCCA, 3C Mai Anh Tuấn, Hà Nội',
                'google_maps_link': 'https://maps.app.goo.gl/R2CnAHudAFhbXdGq6',
                'ticket_limit': 200,
                'status': Event.EventStatus.UPCOMING,
                'category_name': 'Nghệ thuật'
            },
            {
                'name': 'Food Festival Đà Nẵng 2025',
                'description': '<p>Lễ hội ẩm thực quy tụ các món ngon đặc sản từ khắp mọi miền đất nước.</p><p>Khám phá hương vị độc đáo của ẩm thực Việt Nam cùng các màn trình diễn ẩm thực từ các đầu bếp nổi tiếng.</p>',
                'date': timezone.now() + timedelta(days=90),
                'location': 'Công viên biển Đông, Đà Nẵng',
                'google_maps_link': 'https://maps.app.goo.gl/g4rT3QHrMcQYpjx39',
                'ticket_limit': 1500,
                'status': Event.EventStatus.UPCOMING,
                'category_name': 'Ẩm thực'
            },
            {
                'name': 'Hội thảo khởi nghiệp 2025',
                'description': '<p>Chuỗi hội thảo dành cho các startup và doanh nghiệp trẻ tại Việt Nam.</p><p>Học hỏi kinh nghiệm từ các chuyên gia hàng đầu và mở rộng mạng lưới kinh doanh của bạn.</p>',
                'date': timezone.now() + timedelta(days=20),
                'location': 'Dreamplex, 195 Điện Biên Phủ, Bình Thạnh, TP.HCM',
                'google_maps_link': 'https://maps.app.goo.gl/1KYHwfFV7nPUXHKg7',
                'ticket_limit': 150,
                'status': Event.EventStatus.UPCOMING,
                'category_name': 'Kinh doanh'
            },
            {
                'name': 'Workshop thiết kế UI/UX',
                'description': '<p>Workshop chuyên sâu về thiết kế giao diện người dùng và trải nghiệm người dùng.</p><p>Nắm bắt các kỹ năng thiết kế từ các chuyên gia UI/UX hàng đầu.</p>',
                'date': timezone.now() + timedelta(days=10),
                'location': 'UP Coworking Space, 91 Nguyễn Huệ, Quận 1, TP.HCM',
                'google_maps_link': 'https://maps.app.goo.gl/p77izZooZgXbAj1f9',
                'ticket_limit': 50,
                'status': Event.EventStatus.UPCOMING,
                'category_name': 'Giáo dục'
            },
            # Sự kiện đã diễn ra
            {
                'name': 'Vietnam Mobile Day 2024',
                'description': '<p>Sự kiện về công nghệ di động lớn nhất Việt Nam.</p><p>Cập nhật về các xu hướng mới nhất trong lĩnh vực di động và ứng dụng.</p>',
                'date': timezone.now() - timedelta(days=30),
                'location': 'White Palace, 194 Hoàng Văn Thụ, Phú Nhuận, TP.HCM',
                'google_maps_link': 'https://maps.app.goo.gl/9HT6MfptHZjEYi2V6',
                'ticket_limit': 500,
                'status': Event.EventStatus.COMPLETED,
                'category_name': 'Công nghệ'
            },
            {
                'name': 'Yoga & Wellness Festival 2024',
                'description': '<p>Lễ hội yoga và sức khỏe với sự tham gia của các giảng viên yoga nổi tiếng.</p><p>Trải nghiệm các phương pháp yoga khác nhau và các hoạt động vì sức khỏe.</p>',
                'date': timezone.now() - timedelta(days=45),
                'location': 'Công viên Tao Đàn, Quận 1, TP.HCM',
                'google_maps_link': 'https://maps.app.goo.gl/UZ3kZQ9qK7fKA6JRA',
                'ticket_limit': 300,
                'status': Event.EventStatus.COMPLETED,
                'category_name': 'Sức khỏe & Làm đẹp'
            }
        ]
        
        created_count = 0
        for event_data in events:
            # Get category
            category = categories.filter(name=event_data['category_name']).first()
            
            # Skip if category not found
            if not category:
                continue
                
            # Pick a random organizer
            organizer = random.choice(organizers)
            
            # Create or update event
            event, created = Event.objects.update_or_create(
                name=event_data['name'],
                defaults={
                    'organizer': organizer,
                    'category': category,
                    'description': event_data['description'],
                    'date': event_data['date'],
                    'location': event_data['location'],
                    'google_maps_link': event_data['google_maps_link'],
                    'ticket_limit': event_data['ticket_limit'],
                    'status': event_data['status']
                }
            )
            if created:
                created_count += 1
        
        self.stdout.write(f'Created {created_count} events')
    
    def create_tickets(self):
        events = Event.objects.all()
        
        for event in events:
            # VIP Ticket
            Ticket.objects.update_or_create(
                event=event,
                type='VIP',
                defaults={
                    'price': random.randint(500000, 2000000),
                    'quantity': random.randint(20, 100)
                }
            )
            
            # Standard Ticket
            Ticket.objects.update_or_create(
                event=event,
                type='Standard',
                defaults={
                    'price': random.randint(200000, 500000),
                    'quantity': random.randint(100, 500)
                }
            )
            
            # Early Bird (if event is upcoming)
            if event.status == Event.EventStatus.UPCOMING:
                Ticket.objects.update_or_create(
                    event=event,
                    type='Early Bird',
                    defaults={
                        'price': random.randint(100000, 300000),
                        'quantity': random.randint(50, 200)
                    }
                )
        
        self.stdout.write(f'Created tickets for {events.count()} events')
    def create_orders(self):
        attendees = User.objects.filter(role=User.Role.ATTENDEE)
        completed_events = Event.objects.filter(status=Event.EventStatus.COMPLETED)
        upcoming_events = Event.objects.filter(status=Event.EventStatus.UPCOMING)
        
        if not attendees or (not completed_events and not upcoming_events):
            self.stdout.write(self.style.WARNING('Skipping orders: No attendees or events found'))
            return
        
        # For completed events
        for event in completed_events:
            tickets = Ticket.objects.filter(event=event)
            if not tickets:
                continue
                
            # For each attendee, create 1-2 orders
            for attendee in random.sample(list(attendees), min(len(attendees), 3)):
                # Choose a random payment method
                payment_method = random.choice([Order.PaymentMethod.MOMO, Order.PaymentMethod.VNPAY, Order.PaymentMethod.CREDIT_CARD])
                
                # Choose a random ticket
                ticket = random.choice(list(tickets))
                quantity = random.randint(1, 3)
                total_amount = ticket.price * quantity
                
                # Create order
                order = Order.objects.create(
                    user=attendee,
                    ticket=ticket,
                    total_amount=total_amount,
                    payment_status=Order.PaymentStatus.PAID,
                    payment_method=payment_method,
                    quantity=quantity
                )
                
                # Generate a QR code
                qr_code = str(uuid.uuid4())
                
                # Create order detail
                order_detail = OrderDetail.objects.create(
                    order=order,
                    ticket=ticket,
                    qr_code=qr_code,
                    checked_in=True,
                    checkin_time=event.date + timedelta(minutes=random.randint(0, 120))
                )
                
                # Generate QR image (using utility function if available)
                try:
                    qr_image = generate_qr_image(qr_code)
                    order_detail.qr_image.save(f'qr_{qr_code}.png', qr_image, save=True)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Could not generate QR image: {e}'))
        
        # For upcoming events
        for event in upcoming_events:
            tickets = Ticket.objects.filter(event=event)
            if not tickets:
                continue
                
            # For each attendee, create 0-1 orders
            for attendee in random.sample(list(attendees), min(len(attendees), 2)):
                # 50% chance to create an order
                if random.random() < 0.5:
                    continue
                    
                # Choose a random payment method
                payment_method = random.choice([Order.PaymentMethod.MOMO, Order.PaymentMethod.VNPAY, Order.PaymentMethod.CREDIT_CARD])
                
                # Choose a random ticket
                ticket = random.choice(list(tickets))
                quantity = random.randint(1, 2)
                total_amount = ticket.price * quantity
                
                # Create order
                order = Order.objects.create(
                    user=attendee,
                    ticket=ticket,
                    total_amount=total_amount,
                    payment_status=Order.PaymentStatus.PAID,
                    payment_method=payment_method,
                    quantity=quantity
                )
                
                # Generate a QR code
                qr_code = str(uuid.uuid4())
                
                # Create order detail
                order_detail = OrderDetail.objects.create(
                    order=order,
                    ticket=ticket,
                    qr_code=qr_code,
                    checked_in=False
                )
                
                # Generate QR image (using utility function if available)
                try:
                    qr_image = generate_qr_image(qr_code)
                    order_detail.qr_image.save(f'qr_{qr_code}.png', qr_image, save=True)
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'Could not generate QR image: {e}'))
        
        self.stdout.write('Created orders for events')
    def create_reviews(self):
        attendees = User.objects.filter(role=User.Role.ATTENDEE)
        completed_events = Event.objects.filter(status=Event.EventStatus.COMPLETED)
        
        if not attendees or not completed_events:
            self.stdout.write(self.style.WARNING('Skipping reviews: No attendees or completed events found'))
            return
        
        review_comments = [
            "Sự kiện rất tuyệt vời, tôi rất hài lòng với trải nghiệm này!",
            "Tổ chức chuyên nghiệp, nội dung phong phú, tôi sẽ tham gia lần sau.",
            "Địa điểm đẹp, không gian thoáng đãng, nhưng hệ thống âm thanh còn hạn chế.",
            "Chương trình hay nhưng thời gian chờ đợi hơi lâu.",
            "Tôi rất thích sự kiện này, đúng như mong đợi!",
            "Đội ngũ nhân viên rất nhiệt tình và thân thiện.",
            "Sự kiện có nhiều điểm mới mẻ, tôi học hỏi được nhiều điều.",
            "Giá vé hơi cao so với nội dung chương trình.",
            "Sự kiện rất đáng để tham gia, tôi sẽ giới thiệu cho bạn bè.",
            "Tổ chức tốt nhưng còn thiếu một số tiện nghi cơ bản."
        ]
        
        for event in completed_events:
            # Get attendees who have ordered tickets for this event
            orders = Order.objects.filter(
                ticket__event=event, 
                payment_status=Order.PaymentStatus.PAID
            ).values_list('user', flat=True).distinct()
            
            event_attendees = User.objects.filter(id__in=orders)
            
            # If no attendees, use random attendees
            if not event_attendees:
                event_attendees = random.sample(list(attendees), min(len(attendees), 3))
            
            # Create reviews
            for attendee in event_attendees:
                # 70% chance to create a review
                if random.random() < 0.3:
                    continue
                    
                # Skip if already reviewed
                if Review.objects.filter(user=attendee, event=event).exists():
                    continue
                
                Review.objects.create(
                    user=attendee,
                    event=event,
                    rating=random.randint(3, 5),  # Mostly positive ratings
                    comment=random.choice(review_comments)
                )
        
        self.stdout.write('Created reviews for completed events')
    
    def create_discounts(self):
        upcoming_events = Event.objects.filter(status=Event.EventStatus.UPCOMING)
        
        if not upcoming_events:
            self.stdout.write(self.style.WARNING('Skipping discounts: No upcoming events found'))
            return
        
        for event in upcoming_events:
            # 70% chance to create a discount
            if random.random() < 0.3:
                continue
                
            # Create a general discount
            Discount.objects.update_or_create(
                event=event,
                code=f"EVENT{event.id}OFF",
                defaults={
                    'discount_percent': random.randint(10, 30),
                    'expiration_date': event.date - timedelta(days=1),
                    'target_rank': Discount.LoyaltyRank.NONE
                }
            )
            
            # 50% chance to create a gold member discount
            if random.random() < 0.5:
                Discount.objects.update_or_create(
                    event=event,
                    code=f"GOLD{event.id}",
                    defaults={
                        'discount_percent': random.randint(30, 50),
                        'expiration_date': event.date - timedelta(days=1),
                        'target_rank': Discount.LoyaltyRank.GOLD
                    }
                )
        
        self.stdout.write('Created discounts for upcoming events')
    def create_notifications(self):
        attendees = User.objects.filter(role=User.Role.ATTENDEE)
        upcoming_events = Event.objects.filter(status=Event.EventStatus.UPCOMING)
        
        if not attendees or not upcoming_events:
            self.stdout.write(self.style.WARNING('Skipping notifications: No attendees or upcoming events found'))
            return
        
        for event in upcoming_events:
            # Get orders for this event
            orders = Order.objects.filter(
                ticket__event=event, 
                payment_status=Order.PaymentStatus.PAID
            ).values_list('user', flat=True).distinct()
            
            event_attendees = User.objects.filter(id__in=orders)
            
            # Create notifications for attendees
            for attendee in event_attendees:
                Notification.objects.create(
                    user=attendee,
                    event=event,
                    message=f"Sự kiện {event.name} sẽ diễn ra vào ngày {event.date.strftime('%d/%m/%Y')}. Đừng quên tham gia nhé!",
                    is_read=random.choice([True, False])
                )
                
                # 50% chance to create another notification
                if random.random() < 0.5:
                    Notification.objects.create(
                        user=attendee,
                        event=event,
                        message=f"Bạn có thể truy cập địa điểm sự kiện {event.name} tại đây: {event.google_maps_link}",
                        is_read=False
                    )
        
        self.stdout.write('Created notifications for upcoming events')
    
    def create_chat_messages(self):
        users = User.objects.all()
        events = Event.objects.all()
        
        if not users or not events:
            self.stdout.write(self.style.WARNING('Skipping chat messages: No users or events found'))
            return
        
        chat_messages = [
            "Xin chào mọi người!",
            "Sự kiện này có phí đậu xe không nhỉ?",
            "Tôi đang rất háo hức chờ đợi sự kiện này!",
            "Có ai cần đi chung không?",
            "Sự kiện dự kiến kết thúc lúc mấy giờ vậy?",
            "Có dress code nào đặc biệt không?",
            "Mọi người có thể mang theo đồ ăn không?",
            "Có khu vực để xe đạp không?",
            "Trời mưa thì sự kiện có diễn ra không?",
            "Có chỗ ngồi cho người khuyết tật không?"
        ]
        
        for event in random.sample(list(events), min(len(events), 5)):
            # Create 5-10 chat messages per event
            for _ in range(random.randint(5, 10)):
                ChatMessage.objects.create(
                    event=event,
                    sender=random.choice(users),
                    message=random.choice(chat_messages)
                )
        
        self.stdout.write('Created chat messages for events')
    
    def create_event_trends(self):
        events = Event.objects.all()
        
        if not events:
            self.stdout.write(self.style.WARNING('Skipping event trends: No events found'))
            return
        
        for event in events:
            views = 0
            interest_level = 0
            
            # More views and interest for upcoming events
            if event.status == Event.EventStatus.UPCOMING:
                views = random.randint(50, 500)
                interest_level = random.randint(20, 200)
            else:
                views = random.randint(100, 1000)
                interest_level = random.randint(50, 400)
            
            EventTrend.objects.update_or_create(
                event=event,
                defaults={
                    'views': views,
                    'interest_level': interest_level
                }
            )
        
        self.stdout.write('Created event trends')