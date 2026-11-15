import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { useActiveCar } from '../api/useActiveCar';

/** `vehicles/{vin}` is a link to a car, not a screen: it makes that car active and shows the Car tab. */
export function OpenCarRoute({ vin }: { vin: string }) {
  const { select } = useActiveCar();
  useEffect(() => {
    select(vin);
    // `select` is a new function every render; the link's VIN is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin]);
  return <Redirect href="/" />;
}
