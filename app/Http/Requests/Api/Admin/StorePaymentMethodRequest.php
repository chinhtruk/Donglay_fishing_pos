<?php

namespace App\Http\Requests\Api\Admin;

use App\Http\Requests\Api\ApiRequest;
use App\Models\PaymentQrSetting;
use Illuminate\Validation\Rule;

class StorePaymentMethodRequest extends ApiRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'type' => ['required', Rule::in([PaymentQrSetting::TYPE_CASH, PaymentQrSetting::TYPE_QR])],
            'is_enabled' => ['sometimes', 'boolean'],
            'bank_name' => ['nullable', 'string', 'max:120'],
            'account_name' => ['nullable', 'string', 'max:120'],
            'account_number' => ['nullable', 'string', 'max:80'],
            'transfer_note' => ['nullable', 'string', 'max:160'],
            'extra_info' => ['nullable', 'string', 'max:1000'],
            'qr_image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:30720'],
            'remove_qr_image' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'qr_image.image' => 'Tệp QR chưa phải là ảnh phù hợp. Bạn chọn JPG, PNG hoặc WebP nhé.',
            'qr_image.mimes' => 'Ảnh QR hỗ trợ JPG, PNG hoặc WebP nhé.',
            'qr_image.max' => 'Ảnh QR không được lớn hơn 30 MB nhé.',
        ];
    }
}
