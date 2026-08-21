<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\DB;

class OrderTotalsCalculator
{
    public function total(Order $order): int
    {
        // VND không có phần thập phân — tính bằng integer để tránh lệch float
        return (int) $order->items()->sum(DB::raw('CAST(unit_price AS SIGNED) * quantity'));
    }

    public function totalsPayload(Order $order): array
    {
        $total = $this->total($order);

        return [
            'subtotal' => $total,
            'total' => $total,
        ];
    }
}
