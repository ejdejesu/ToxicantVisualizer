# Generated by Django 3.1.1 on 2020-09-29 21:22

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='TRImodel',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.IntegerField()),
                ('facilityname', models.TextField(blank=True)),
                ('address', models.TextField(blank=True, null=True)),
                ('city', models.TextField(blank=True, null=True)),
                ('county', models.TextField(blank=True, null=True)),
                ('state', models.TextField(blank=True, null=True)),
                ('zip', models.TextField(blank=True, null=True)),
                ('latitude', models.FloatField(blank=True)),
                ('longitude', models.FloatField(blank=True)),
                ('chemical', models.TextField(blank=True, null=True)),
            ],
        ),
    ]