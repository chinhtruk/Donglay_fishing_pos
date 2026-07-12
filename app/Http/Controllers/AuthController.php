<?php

namespace App\Http\Controllers;

use App\Mail\EmployeeOtpMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function adminLogin(Request $request): JsonResponse
    {
        $credentials = $request->validate(['username' => ['required', 'string'], 'password' => ['required', 'string']]);
        $user = User::where('username', $credentials['username'])->where('role', 'admin')->first();
        if (! $user || ! $user->is_active || ! $user->password || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages(['username' => 'Thông tin đăng nhập chưa khớp. Bạn thử lại chậm rãi một lần nữa nhé.']);
        }
        Auth::login($user);
        $request->session()->regenerate();

        return response()->json(['message' => 'Chào mừng bạn trở lại.', 'redirect' => '/admin/dashboard']);
    }

    public function requestOtp(Request $request): JsonResponse
    {
        $data = $this->validateEmployeeUsername($request);
        $user = $this->employeeByUsername($data['username']);
        if ($user) {
            $latest = $user->otpChallenges()->latest()->first();
            if (! $latest || $latest->created_at->lte(now()->subSeconds(60))) {
                $code = (string) random_int(100000, 999999);
                $user->otpChallenges()->create(['code_hash' => Hash::make($code), 'expires_at' => now()->addMinutes(10)]);
                Mail::to($user->email)->queue(new EmployeeOtpMail($code));
            }
        }

        return response()->json(['message' => "Nếu tên đăng nhập hợp lệ, mã sẽ được gửi đến email liên kết trong ít phút.\nBạn nhớ kiểm tra cả thư rác nhé."]);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $this->validateEmployeeUsername($request, true);
        $user = $this->employeeByUsername($data['username']);
        $challenge = $user?->otpChallenges()->whereNull('used_at')->latest()->first();
        if (! $user || ! $challenge || $challenge->expires_at->isPast() || $challenge->attempts >= 5 || ! Hash::check($data['code'], $challenge->code_hash)) {
            if ($challenge && $challenge->attempts < 5) {
                $challenge->increment('attempts');
            }
            throw ValidationException::withMessages(['code' => 'Mã này chưa đúng hoặc đã hết hạn. Bạn có thể xin một mã mới và thử lại nhé.']);
        }
        $challenge->update(['used_at' => now()]);
        Auth::login($user);
        $request->session()->regenerate();

        return response()->json(['message' => 'Đăng nhập thành công.', 'redirect' => '/pos/coffee']);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['redirect' => '/login']);
    }

    public function profile(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->only('id', 'name', 'username', 'email', 'role')]);
    }

    private function validateEmployeeUsername(Request $request, bool $withCode = false): array
    {
        $request->merge([
            'username' => mb_strtolower(trim((string) $request->input('username'))),
        ]);

        $rules = [
            'username' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9._-]+$/'],
        ];
        if ($withCode) {
            $rules['code'] = ['required', 'digits:6'];
        }

        return $request->validate($rules);
    }

    private function employeeByUsername(string $username): ?User
    {
        return User::where('username', $username)
            ->where('role', 'employee')
            ->whereNotNull('email')
            ->whereNotNull('email_verified_at')
            ->where('is_active', true)
            ->first();
    }
}
