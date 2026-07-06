<?php

namespace App\Services;

use App\Models\CoffeeTable;
use App\Models\FishingSpot;
use App\Models\Order;

class PosNotificationMessageFactory
{
    public function coffeeCreated(Order $order, CoffeeTable $table): array
    {
        return $this->event('Đơn cà phê mới', "{$table->label} vừa gọi {$this->itemCountText($order)}.", $order, 'coffee_order_created');
    }

    public function counterCoffeeCreated(Order $order): array
    {
        return $this->event('Đơn tại quầy mới', "Một đơn chưa xác định bàn vừa gọi {$this->itemCountText($order)}.", $order, 'counter_order_created');
    }

    public function coffeeAssigned(Order $order, ?CoffeeTable $table): array
    {
        return $this->event(
            'Cập nhật vị trí đơn',
            $table ? "Đơn {$order->order_number} đã được chuyển vào {$table->label}." : "Đơn {$order->order_number} đang để ở trạng thái chưa xác định bàn.",
            $order,
            'coffee_order_assigned'
        );
    }

    public function coffeeUpdated(Order $order): array
    {
        return $this->event('Cập nhật món cà phê', "{$this->resourceLabel($order)} vừa cập nhật món gọi thêm, hiện có {$this->itemCountText($order)}.", $order, 'coffee_order_updated');
    }

    public function coffeePaymentCompleted(Order $order, float $amount, int $paymentId): array
    {
        return $this->event('Thanh toán cà phê', "{$this->resourceLabel($order)} vừa thanh toán {$this->moneyText($amount)}.", $order, 'coffee_payment_completed', ['payment_id' => $paymentId]);
    }

    public function fishingStarted(Order $order, FishingSpot $spot): array
    {
        return $this->event('Phiên câu mới', "{$spot->label} vừa bắt đầu phiên câu 4 giờ.", $order, 'fishing_session_started');
    }

    public function fishingExtended(Order $order, string $extensionText, string $durationText): array
    {
        $order->loadMissing('fishingSession');

        return $this->event('Gia hạn chòi câu', "{$this->resourceLabel($order)} vừa gia hạn thêm {$extensionText} ({$durationText}), kết thúc lúc {$order->fishingSession->ends_at->format('H:i')}.", $order, 'fishing_session_extended');
    }

    public function fishTakeawayUpdated(Order $order): array
    {
        return $this->event('Cập nhật giá phiên câu', "{$this->resourceLabel($order)} vừa cập nhật tùy chọn lấy cá mang về.", $order, 'fishing_order_updated');
    }

    public function fishingUpdated(Order $order): array
    {
        return $this->event('Cập nhật món ở chòi', "{$this->resourceLabel($order)} vừa gọi thêm/cập nhật món, hiện có {$this->itemCountText($order)}.", $order, 'fishing_order_updated');
    }

    public function fishingPaymentCompleted(Order $order, float $amount, int $paymentId): array
    {
        return $this->event('Thanh toán chòi câu', "{$this->resourceLabel($order)} vừa thanh toán {$this->moneyText($amount)}.", $order, 'fishing_payment_completed', ['payment_id' => $paymentId]);
    }

    public function coffeeMerged(Order $order, string $sourceLabel, CoffeeTable $targetTable): array
    {
        return $this->event('Gộp hóa đơn cà phê', "{$sourceLabel} đã được gộp vào {$targetTable->label}.", $order, 'coffee_order_merged');
    }

    public function coffeeReleased(Order $order): array
    {
        return $this->event('Giải phóng bàn', "{$this->resourceLabel($order)} đã được giải phóng sau thanh toán.", $order, 'coffee_order_released');
    }

    public function fishingReleased(Order $order): array
    {
        return $this->event('Giải phóng chòi', "{$this->resourceLabel($order)} đã được giải phóng sau thanh toán.", $order, 'fishing_order_released');
    }

    public function fishingMerged(Order $order, string $sourceLabel, FishingSpot $targetSpot): array
    {
        return $this->event('Gộp hóa đơn chòi', "{$sourceLabel} đã được gộp vào {$targetSpot->label}.", $order, 'fishing_order_merged');
    }

    public function resourceLabel(Order $order): string
    {
        $order->loadMissing(['coffeeTable', 'fishingSpot']);

        return $order->service_type === 'coffee'
            ? ($order->coffeeTable?->label ?? 'Đơn tại quầy')
            : ($order->fishingSpot?->label ?? 'Chòi câu');
    }

    private function event(string $title, string $message, Order $order, string $type, array $meta = []): array
    {
        return compact('title', 'message', 'type', 'meta') + ['url' => $this->orderUrl($order)];
    }

    private function itemCountText(Order $order): string
    {
        $query = $order->items();
        if ($order->service_type === 'fishing') {
            $query->where('line_type', 'menu');
        }
        $count = (int) $query->sum('quantity');

        return $count.' món';
    }

    private function moneyText(float $amount): string
    {
        return number_format($amount, 0, ',', '.').' đ';
    }

    private function orderUrl(Order $order): string
    {
        $order->loadMissing(['coffeeTable', 'fishingSpot']);

        if ($order->service_type === 'coffee') {
            return $order->coffee_table_id ? "/pos/coffee?table={$order->coffee_table_id}" : "/pos/coffee?order={$order->id}";
        }

        return $order->fishing_spot_id ? "/pos/fishing?spot={$order->fishing_spot_id}" : "/pos/fishing?order={$order->id}";
    }
}
