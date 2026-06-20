import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFormik } from 'formik';
import { Loader2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Yup from 'yup';
import Page from '../components/Page/Page';
import { register } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

const RegisterSchema = Yup.object().shape({
  // Because Yup.string().email() sucks
  email: Yup.string()
    .matches(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Invalid email'
    )
    .required('Required'),
  firstName: Yup.string().required('Required'),
  lastName: Yup.string().required('Required'),
  nickName: Yup.string().required('Required'),
  password: Yup.string()
    .required('Required')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})/,
      'Must contain 8 characters, one uppercase, one lowercase, one number, and one special character'
    ),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Required'),
});

const FieldError = ({
  show,
  children,
}: {
  show: boolean | undefined;
  children?: ReactNode;
}): ReactNode =>
  show === true ? (
    <p className="text-destructive text-right text-sm">{children}</p>
  ) : null;

const RegisterPage = (): ReactNode => {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.user);
  const navigate = useNavigate();
  const formik = useFormik({
    initialValues: {
      email: '',
      firstName: '',
      lastName: '',
      nickName: '',
      password: '',
      confirmPassword: '',
    },
    onSubmit: (values) => {
      dispatch(register(values))
        .then((action) => {
          // Get status of register
          if (register.fulfilled.match(action)) {
            // Successfully registered, redirect user to login page
            void navigate('/login');
          } else if (register.rejected.match(action)) {
            // Failed to register, show an error message
            // TODO(jan)
          }
        })
        .catch(() => {});
    },
    validationSchema: RegisterSchema,
    validateOnMount: true,
  });

  return (
    <Page>
      <div className="flex items-center justify-center p-4">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
          <div className="flex flex-col items-center">
            <h1 className="text-center text-4xl font-bold">Sign up</h1>
          </div>
          <div className="bg-card text-card-foreground rounded-lg p-8 shadow-lg">
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="flex flex-col gap-4">
                <div className="flex flex-row gap-2">
                  <div className="grid flex-1 gap-1.5">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      name="firstName"
                      aria-invalid={
                        formik.errors.firstName != null &&
                        formik.touched.firstName
                      }
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <FieldError
                      show={
                        formik.errors.firstName != null &&
                        formik.touched.firstName
                      }
                    >
                      {formik.errors.firstName}
                    </FieldError>
                  </div>
                  <div className="grid flex-1 gap-1.5">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      name="lastName"
                      aria-invalid={
                        formik.errors.lastName != null &&
                        formik.touched.lastName
                      }
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                    />
                    <FieldError
                      show={
                        formik.errors.lastName != null &&
                        formik.touched.lastName
                      }
                    >
                      {formik.errors.lastName}
                    </FieldError>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="nickName">Display Name</Label>
                  <Input
                    id="nickName"
                    type="text"
                    name="nickName"
                    aria-invalid={
                      formik.errors.nickName != null && formik.touched.nickName
                    }
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <FieldError
                    show={
                      formik.errors.nickName != null && formik.touched.nickName
                    }
                  >
                    {formik.errors.nickName}
                  </FieldError>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    name="email"
                    aria-invalid={
                      error === 409 ||
                      (formik.errors.email != null && formik.touched.email)
                    }
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <FieldError
                    show={
                      error === 409 ||
                      (formik.errors.email != null && formik.touched.email)
                    }
                  >
                    {error === 409
                      ? 'Email is already in use'
                      : formik.errors.email}
                  </FieldError>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    name="password"
                    aria-invalid={
                      formik.errors.password != null && formik.touched.password
                    }
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <FieldError
                    show={
                      formik.errors.password != null && formik.touched.password
                    }
                  >
                    {formik.errors.password}
                  </FieldError>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    aria-invalid={
                      formik.errors.confirmPassword != null &&
                      formik.touched.confirmPassword
                    }
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                  />
                  <FieldError
                    show={
                      formik.errors.confirmPassword != null &&
                      formik.touched.confirmPassword
                    }
                  >
                    {formik.errors.confirmPassword}
                  </FieldError>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Label htmlFor="requestOrganizer" className="pr-4">
                    Are you an organizer?
                  </Label>
                  <Checkbox id="requestOrganizer" />
                  <span>Yes</span>
                </div>
                <div className="flex flex-col gap-10 pt-2">
                  <Button
                    type="submit"
                    disabled={loading || !formik.isValid}
                    size="lg"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : null}
                    Sign up
                  </Button>
                </div>
                {error != null ? (
                  <p className="text-destructive text-center text-sm">
                    Registration failed
                  </p>
                ) : null}
                <div className="pt-2">
                  <p className="text-center">
                    Already a user?{' '}
                    <span
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer text-blue-500"
                      onClick={() => {
                        void navigate('/login');
                      }}
                    >
                      Login
                    </span>
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default RegisterPage;
