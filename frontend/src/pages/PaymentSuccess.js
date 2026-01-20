import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { paymentAPI } from '@/utils/api';
import { toast } from 'sonner';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('checking');
  const [attempts, setAttempts] = useState(0);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    }
  }, [sessionId]);

  const pollPaymentStatus = async () => {
    const maxAttempts = 5;
    
    try {
      const response = await paymentAPI.getStatus(sessionId);
      
      if (response.data.payment_status === 'paid') {
        setStatus('success');
        toast.success('Payment successful!');
        return;
      }
      
      if (attempts < maxAttempts) {
        setAttempts(prev => prev + 1);
        setTimeout(pollPaymentStatus, 2000);
      } else {
        setStatus('timeout');
        toast.error('Payment verification timed out. Please contact support.');
      }
    } catch (error) {
      setStatus('error');
      toast.error('Failed to verify payment status');
    }
  };

  return (
    <div className="dashboard-container" data-testid="payment-success-page">
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto glass-card text-center">
          <CardHeader>
            {status === 'checking' && (
              <>
                <Loader2 className="h-16 w-16 mx-auto mb-4 text-blue-600 animate-spin" />
                <CardTitle className="text-2xl">Verifying Payment</CardTitle>
                <CardDescription>Please wait while we confirm your payment...</CardDescription>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600" />
                <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
                <CardDescription>Your subscription has been activated</CardDescription>
              </>
            )}
            {(status === 'timeout' || status === 'error') && (
              <>
                <div className="h-16 w-16 mx-auto mb-4 text-red-600 text-4xl">!</div>
                <CardTitle className="text-2xl text-red-600">Verification Issue</CardTitle>
                <CardDescription>
                  {status === 'timeout'
                    ? 'Payment verification timed out'
                    : 'Failed to verify payment'}
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {status === 'success' && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Thank you for your payment! Your organization now has access to all premium features.
                </p>
                <Button onClick={() => navigate('/dashboard')} className="w-full" data-testid="back-to-dashboard-button">
                  Go to Dashboard
                </Button>
              </div>
            )}
            {status === 'checking' && (
              <p className="text-sm text-muted-foreground">Attempt {attempts + 1} of 5...</p>
            )}
            {(status === 'timeout' || status === 'error') && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Please check your email for payment confirmation or contact support for assistance.
                </p>
                <Button onClick={() => navigate('/dashboard')} className="w-full" data-testid="back-to-dashboard-button">
                  Back to Dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentSuccess;