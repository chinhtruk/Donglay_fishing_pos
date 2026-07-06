<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;

class OrderNumberGenerator
{
    public function order(string $prefix): string
    {
        return $this->unique($prefix, fn (string $number) => Order::query()->where('order_number', $number)->exists());
    }

    public function payment(): string
    {
        return $this->unique('PM', fn (string $number) => Payment::query()->where('payment_number', $number)->exists());
    }

    private function unique(string $prefix, callable $exists): string
    {
        do {
            $number = $prefix.'-'.strtoupper(bin2hex(random_bytes(3)));
        } while ($exists($number));

        return $number;
    }
}
