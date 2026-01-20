import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="dashboard-container" data-testid="payment-cancel-page">
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-md mx-auto glass-card text-center">
          <CardHeader>
            <XCircle className="h-16 w-16 mx-auto mb-4 text-orange-600" />
            <CardTitle className="text-2xl">Payment Cancelled</CardTitle>
            <CardDescription>Your payment was cancelled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                No charges were made. You can try again whenever you're ready to upgrade your plan.
              </p>
              <Button onClick={() => navigate('/dashboard')} className="w-full" data-testid="back-to-dashboard-button">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentCancel;