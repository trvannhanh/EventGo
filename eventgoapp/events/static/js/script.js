// Kiểm tra các đơn hàng sắp hết hạn trong OrderAdmin
document.addEventListener('DOMContentLoaded', function() {
    // Lấy tất cả các ô trong cột expiration_time
    const expirationCells = document.querySelectorAll('td.field-expiration_time');
    const now = new Date();

    expirationCells.forEach(cell => {
        const expirationText = cell.innerText.trim();
        if (expirationText !== 'N/A') {
            const expirationDate = new Date(expirationText);
            const timeDiff = expirationDate - now;
            const minutesLeft = Math.floor(timeDiff / (1000 * 60));

            // Nếu còn dưới 5 phút, làm nổi bật hàng
            if (minutesLeft > 0 && minutesLeft <= 5) {
                cell.parentElement.classList.add('expiring-soon');
            }
        }
    });

    // Theo dõi thay đổi trạng thái checked_in trong OrderDetailInline
    const checkedInInputs = document.querySelectorAll('input[name$="checked_in"]');
    checkedInInputs.forEach(input => {
        input.addEventListener('change', function() {
            const label = this.nextElementSibling || this.previousElementSibling;
            const status = this.checked ? 'Đã check-in' : 'Chưa check-in';
            alert(`Trạng thái đã thay đổi: ${status}`);
        });
    });

    // Tùy chỉnh trạng thái checked_in trong danh sách OrderDetailAdmin
    const checkedInCells = document.querySelectorAll('td.field-checked_in');
    checkedInCells.forEach(cell => {
        const text = cell.innerText.trim().toLowerCase();
        if (text === 'true') {
            cell.classList.add('checked-in-true');
            cell.innerText = 'Đã check-in';
        } else if (text === 'false') {
            cell.classList.add('checked-in-false');
            cell.innerText = 'Chưa check-in';
        }
    });
});