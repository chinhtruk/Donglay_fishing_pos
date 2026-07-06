<?php

namespace App\Services;

use App\Http\Requests\Api\Admin\StorePaymentMethodRequest;
use App\Http\Requests\Api\Admin\UpdatePaymentSettingsRequest;
use App\Models\PaymentQrSetting;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AdminPaymentMethodService
{
    public function __construct(private readonly AdminAuditLogger $audit)
    {
    }

    public function settingsPayload(): array
    {
        return [
            'methods' => PaymentQrSetting::methodsPayload(forAdmin: true),
            'qr' => PaymentQrSetting::current()->payload(),
        ];
    }

    public function updateSettings(UpdatePaymentSettingsRequest $request): array
    {
        $setting = PaymentQrSetting::current();
        $before = $setting->toArray();
        $data = $request->validated();

        $payload = [
            'code' => $setting->code ?: PaymentQrSetting::TYPE_QR,
            'name' => $setting->name ?: 'QR chuyển khoản',
            'type' => PaymentQrSetting::TYPE_QR,
            'sort_order' => $setting->sort_order ?? 10,
            'is_enabled' => $request->boolean('is_enabled'),
            'bank_name' => filled($data['bank_name'] ?? null) ? trim($data['bank_name']) : null,
            'account_name' => filled($data['account_name'] ?? null) ? trim($data['account_name']) : null,
            'account_number' => filled($data['account_number'] ?? null) ? trim($data['account_number']) : null,
            'transfer_note' => filled($data['transfer_note'] ?? null) ? trim($data['transfer_note']) : null,
            'extra_info' => filled($data['extra_info'] ?? null) ? trim($data['extra_info']) : null,
        ];

        $storedPath = null;
        $oldImagePath = $setting->qr_image_path;

        try {
            if ($request->hasFile('qr_image')) {
                $storedPath = $request->file('qr_image')->store('payment-qr', 'public');
                $payload['qr_image_path'] = $storedPath;
            } elseif ($request->boolean('remove_qr_image')) {
                $payload['qr_image_path'] = null;
            }

            $finalImagePath = array_key_exists('qr_image_path', $payload)
                ? $payload['qr_image_path']
                : $setting->qr_image_path;

            if ($payload['is_enabled'] && ! $finalImagePath) {
                throw ValidationException::withMessages(['qr_image' => 'Bạn cần thêm ảnh QR trước khi bật thanh toán QR.']);
            }

            $setting->update($payload);

            if (($storedPath || $request->boolean('remove_qr_image')) && $oldImagePath && $oldImagePath !== $setting->qr_image_path) {
                Storage::disk('public')->delete($oldImagePath);
            }
        } catch (\Throwable $exception) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $exception;
        }

        $fresh = $setting->fresh();
        $this->audit->record($request->user(), 'payment_qr.updated', $setting, $before, $fresh->toArray());

        return [
            'message' => 'Cấu hình thanh toán QR đã được lưu.',
            'methods' => PaymentQrSetting::methodsPayload(forAdmin: true),
            'qr' => $fresh->payload(),
        ];
    }

    public function create(StorePaymentMethodRequest $request): array
    {
        [$payload, $storedPath] = $this->paymentMethodPayload($request);

        if ($payload['type'] === PaymentQrSetting::TYPE_CASH && PaymentQrSetting::query()->where('type', PaymentQrSetting::TYPE_CASH)->exists()) {
            throw ValidationException::withMessages(['type' => 'Phương thức tiền mặt đã có sẵn. Bạn chỉ cần chỉnh sửa dòng hiện tại nhé.']);
        }

        $payload['code'] = PaymentQrSetting::nextCode($payload['type']);
        $payload['sort_order'] = ((int) PaymentQrSetting::query()->max('sort_order')) + 10;

        try {
            $method = PaymentQrSetting::create($payload);
        } catch (\Throwable $exception) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $exception;
        }

        $this->audit->record($request->user(), 'payment_method.created', $method, null, $method->toArray());

        return [
            'message' => 'Phương thức thanh toán đã được thêm.',
            'method' => $method->fresh()->adminPayload(),
            'methods' => PaymentQrSetting::methodsPayload(forAdmin: true),
        ];
    }

    public function update(StorePaymentMethodRequest $request, PaymentQrSetting $paymentMethod): array
    {
        $before = $paymentMethod->toArray();
        [$payload, $storedPath] = $this->paymentMethodPayload($request, $paymentMethod);
        $oldImagePath = $paymentMethod->qr_image_path;

        try {
            $paymentMethod->update($payload);

            if (($storedPath || $request->boolean('remove_qr_image') || array_key_exists('qr_image_path', $payload)) && $oldImagePath && $oldImagePath !== $paymentMethod->qr_image_path) {
                Storage::disk('public')->delete($oldImagePath);
            }
        } catch (\Throwable $exception) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $exception;
        }

        $fresh = $paymentMethod->fresh();
        $this->audit->record($request->user(), 'payment_method.updated', $paymentMethod, $before, $fresh->toArray());

        return [
            'message' => 'Phương thức thanh toán đã được cập nhật.',
            'method' => $fresh->adminPayload(),
            'methods' => PaymentQrSetting::methodsPayload(forAdmin: true),
        ];
    }

    private function paymentMethodPayload(StorePaymentMethodRequest $request, ?PaymentQrSetting $method = null): array
    {
        $data = $request->validated();

        if ($method) {
            $data['type'] = $method->type ?: $data['type'];
        }

        $payload = [
            'name' => trim($data['name']),
            'type' => $data['type'],
            'is_enabled' => $request->boolean('is_enabled'),
            'bank_name' => filled($data['bank_name'] ?? null) ? trim($data['bank_name']) : null,
            'account_name' => filled($data['account_name'] ?? null) ? trim($data['account_name']) : null,
            'account_number' => filled($data['account_number'] ?? null) ? trim($data['account_number']) : null,
            'transfer_note' => filled($data['transfer_note'] ?? null) ? trim($data['transfer_note']) : null,
            'extra_info' => filled($data['extra_info'] ?? null) ? trim($data['extra_info']) : null,
        ];

        if ($method) {
            $payload['code'] = $method->code ?: PaymentQrSetting::nextCode($payload['type']);
            $payload['sort_order'] = $method->sort_order ?? 10;
        }

        $storedPath = null;
        if ($request->hasFile('qr_image')) {
            $storedPath = $request->file('qr_image')->store('payment-qr', 'public');
            $payload['qr_image_path'] = $storedPath;
        } elseif ($request->boolean('remove_qr_image')) {
            $payload['qr_image_path'] = null;
        }

        if ($payload['type'] === PaymentQrSetting::TYPE_CASH) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
                $storedPath = null;
            }
            $payload['bank_name'] = null;
            $payload['account_name'] = null;
            $payload['account_number'] = null;
            $payload['transfer_note'] = null;
            $payload['extra_info'] = null;
            $payload['qr_image_path'] = null;
        }

        $finalImagePath = array_key_exists('qr_image_path', $payload)
            ? $payload['qr_image_path']
            : $method?->qr_image_path;

        if ($payload['is_enabled'] && $payload['type'] === PaymentQrSetting::TYPE_QR && ! $finalImagePath) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw ValidationException::withMessages(['qr_image' => 'Bạn cần thêm ảnh QR trước khi bật phương thức này.']);
        }

        return [$payload, $storedPath];
    }
}
