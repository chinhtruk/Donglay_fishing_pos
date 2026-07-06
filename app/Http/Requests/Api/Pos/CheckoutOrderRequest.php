<?php

namespace App\Http\Requests\Api\Pos;

use App\Http\Requests\Api\ApiRequest;
use App\Models\PaymentQrSetting;

class CheckoutOrderRequest extends ApiRequest
{
    public function rules(): array
    {
        $method = $this->paymentMethod();

        return [
            'version' => ['required', 'integer'],
            'payment_method' => ['sometimes', 'string', 'max:20'],
            'cash_received' => [$method === PaymentQrSetting::TYPE_CASH ? 'required' : 'nullable', 'numeric', 'min:0'],
            'items' => ['sometimes', 'array'],
            'items.*.order_item_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'release' => ['sometimes', 'boolean'],
        ];
    }

    public function paymentMethod(): string
    {
        return (string) $this->input('payment_method', PaymentQrSetting::TYPE_CASH);
    }
}
